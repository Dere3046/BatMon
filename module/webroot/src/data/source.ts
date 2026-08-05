import type { BatMonSnapshot } from './types';
import {
  parseBattery,
  parseConfig,
  parseCpu,
  parseDrain,
  parseEvents,
  parseHistory,
  parseInfo,
  parsePsy,
  parseSuspend,
  parseTasks,
} from './parser';

export interface DataSource {
  readonly kind: 'proc';
  readAll(): Promise<BatMonSnapshot>;
}

const NODES = [
  'info',
  'battery',
  'drain',
  'history',
  'events',
  'tasks',
  'deltas',
  'cpu',
  'psy',
  'suspend',
  'config',
] as const;

const NODE_LIST = NODES.join(' ');
const SEP = '###BATMON###';
const BATCH_CMD = `for f in ${NODE_LIST}; do echo "${SEP}$f"; cat /proc/batmon/$f; done`;

interface Runtime {
  readAll(): Promise<Map<string, string>>;
}

declare global {
  interface Window {
    __batmon_cb?: (code: number, stdout: string, stderr: string) => void;
    ksu?: {
      exec(cmd: string, options: string, callbackFunc: string): void;
      exec(cmd: string): string;
    };
    _batmon_File?: {
      read(path: string): Promise<string>;
    };
  }
}

function splitBatch(stdout: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const part of stdout.split(SEP)) {
    const nl = part.indexOf('\n');
    if (nl < 0) continue;
    const node = part.slice(0, nl).trim();
    if ((NODES as readonly string[]).includes(node)) {
      out.set(node, part.slice(nl + 1));
    }
  }
  return out;
}

function mmrlRuntime(): Runtime | null {
  if (!window._batmon_File?.read) return null;
  return {
    readAll: async () => {
      const out = new Map<string, string>();
      for (const n of NODES) {
        out.set(n, await window._batmon_File!.read(`/proc/batmon/${n}`));
      }
      return out;
    },
  };
}

function ksuRuntime(): Runtime | null {
  if (!window.ksu?.exec) return null;

  const asyncExec = (): Promise<Map<string, string>> =>
    new Promise((resolve, reject) => {
      window.__batmon_cb = (code: number, stdout: string, stderr: string) => {
        delete window.__batmon_cb;
        if (code !== 0) {
          reject(new Error(stderr.trim() || `exit ${code}`));
        } else {
          resolve(splitBatch(stdout));
        }
      };
      try {
        window.ksu!.exec(BATCH_CMD, '{}', '__batmon_cb');
      } catch (e) {
        delete window.__batmon_cb;
        reject(e);
      }
    });

  const syncExec = async (): Promise<Map<string, string>> => {
    const out = new Map<string, string>();
    for (const n of NODES) {
      out.set(n, window.ksu!.exec(`cat /proc/batmon/${n}`));
    }
    return out;
  };

  return {
    readAll: async () => {
      try {
        return await asyncExec();
      } catch {
        return await syncExec();
      }
    },
  };
}

function getRuntime(): Runtime | null {
  return mmrlRuntime() ?? ksuRuntime();
}

export class ProcSource implements DataSource {
  readonly kind = 'proc' as const;
  private runtime: Runtime;

  constructor() {
    const rt = getRuntime();
    if (!rt) {
      throw new Error('no ksu, apatch or mmrl runtime detected');
    }
    this.runtime = rt;
  }

  async readAll(): Promise<BatMonSnapshot> {
    const m = await this.runtime.readAll();
    const need = (n: string): string => m.get(n) ?? '';

    return {
      info: parseInfo(need('info')),
      battery: parseBattery(need('battery')),
      drain: parseDrain(need('drain')),
      history: parseHistory(need('history').split('\n')),
      events: parseEvents(need('events').split('\n')),
      tasks: parseTasks(need('tasks').split('\n')),
      deltas: parseTasks(need('deltas').split('\n')),
      cpu: parseCpu(need('cpu').split('\n')),
      psy: parsePsy(need('psy').split('\n')),
      suspend: parseSuspend(need('suspend').split('\n')),
      config: parseConfig(need('config')),
      fetchedAt: Date.now(),
    };
  }
}
