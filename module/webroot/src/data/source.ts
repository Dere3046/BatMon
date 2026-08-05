import type { BatMonSnapshot, ConfigData } from './types';
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
  setConfig(values: Partial<ConfigData>): Promise<void>;
}

const SMALL_NODES = [
  'info',
  'battery',
  'drain',
  'events',
  'cpu',
  'psy',
  'suspend',
  'config',
] as const;

const LARGE_NODES = ['history', 'tasks', 'deltas'] as const;

const ALL_NODES = [...SMALL_NODES, ...LARGE_NODES] as const;

const SEP = '###BATMON###';

function batchCmd(nodes: readonly string[]): string {
  return `for f in ${nodes.join(' ')}; do echo "${SEP}$f"; cat /proc/batmon/$f; done`;
}

interface Runtime {
  readAll(): Promise<Map<string, string>>;
  writeConfig(lines: string[]): Promise<void>;
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
      write(path: string, data: string): Promise<void>;
    };
  }
}

function splitBatch(stdout: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const part of stdout.split(SEP)) {
    const nl = part.indexOf('\n');
    if (nl < 0) continue;
    const node = part.slice(0, nl).trim();
    if ((ALL_NODES as readonly string[]).includes(node)) {
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
      for (const n of ALL_NODES) {
        out.set(n, await window._batmon_File!.read(`/proc/batmon/${n}`));
      }
      return out;
    },
    writeConfig: async (lines: string[]) => {
      await window._batmon_File!.write('/proc/batmon/config', lines.join('\n') + '\n');
    },
  };
}

function ksuRuntime(): Runtime | null {
  if (!window.ksu?.exec) return null;

  const EXEC_TIMEOUT_MS = 10000;

  const execOnce = (cmd: string): Promise<string> =>
    new Promise((resolve, reject) => {
      let done = false;
      const timer = setTimeout(() => {
        if (!done) {
          done = true;
          delete window.__batmon_cb;
          reject(new Error('exec timeout'));
        }
      }, EXEC_TIMEOUT_MS);
      window.__batmon_cb = (code: number, stdout: string, stderr: string) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        delete window.__batmon_cb;
        if (code !== 0) {
          reject(new Error(stderr.trim() || `exit ${code}`));
        } else {
          resolve(stdout);
        }
      };
      try {
        window.ksu!.exec(cmd, '{}', '__batmon_cb');
      } catch (e) {
        clearTimeout(timer);
        delete window.__batmon_cb;
        reject(e);
      }
    });

  const asyncRead = async (): Promise<Map<string, string>> => {
    const small = await execOnce(batchCmd(SMALL_NODES));
    const large = await execOnce(batchCmd(LARGE_NODES));
    const out = splitBatch(small);
    for (const [k, v] of splitBatch(large)) {
      out.set(k, v);
    }
    return out;
  };

  const syncRead = async (): Promise<Map<string, string>> => {
    const out = new Map<string, string>();
    for (const n of ALL_NODES) {
      out.set(n, window.ksu!.exec(`cat /proc/batmon/${n}`));
    }
    return out;
  };

  return {
    readAll: async () => {
      try {
        return await asyncRead();
      } catch {
        return await syncRead();
      }
    },
    writeConfig: async (lines: string[]) => {
      const cmd = lines.map((l) => `printf '%s\\n' '${l}' > /proc/batmon/config`).join('; ');
      await execOnce(cmd);
    },
  };
}

function getRuntime(): Runtime | null {
  return mmrlRuntime() ?? ksuRuntime();
}

function configToLines(values: Partial<ConfigData>): string[] {
  const lines: string[] = [];
  if (values.pollMs !== undefined) lines.push(`poll_ms=${values.pollMs}`);
  if (values.jumpPct !== undefined) lines.push(`jump_pct=${values.jumpPct}`);
  if (values.ratePctMin !== undefined) lines.push(`rate_pct_min=${values.ratePctMin}`);
  if (values.warnMa !== undefined) lines.push(`warn_ma=${values.warnMa}`);
  if (values.dropMa !== undefined) lines.push(`drop_ma=${values.dropMa}`);
  if (values.dropPctMin !== undefined) lines.push(`drop_pct_min=${values.dropPctMin}`);
  if (values.enabled !== undefined) lines.push(`enabled=${values.enabled ? 1 : 0}`);
  if (values.logDmesg !== undefined) lines.push(`log_dmesg=${values.logDmesg ? 1 : 0}`);
  return lines;
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

  async setConfig(values: Partial<ConfigData>): Promise<void> {
    const lines = configToLines(values);
    if (lines.length > 0) {
      await this.runtime.writeConfig(lines);
    }
  }
}
