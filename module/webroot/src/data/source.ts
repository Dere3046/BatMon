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

interface Runtime {
  read(path: string): Promise<string>;
}

declare global {
  interface Window {
    ksu?: {
      exec(
        cmd: string,
        opts: Record<string, unknown>,
        cb: (errno: number, stdout: string) => void,
      ): void;
    };
    _batmon_File?: {
      read(path: string): Promise<string>;
    };
  }
}

function getRuntime(): Runtime | null {
  if (window.ksu?.exec) {
    return {
      read: (path: string) =>
        new Promise<string>((resolve, reject) => {
          window.ksu!.exec(`cat ${path}`, {}, (errno, stdout) => {
            if (errno !== 0) {
              reject(new Error(`cat ${path} failed errno ${errno}`));
            } else {
              resolve(stdout);
            }
          });
        }),
    };
  }
  if (window._batmon_File?.read) {
    return { read: (path: string) => window._batmon_File!.read(path) };
  }
  return null;
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

export class ProcSource implements DataSource {
  readonly kind = 'proc' as const;
  private runtime: Runtime;

  constructor() {
    const rt = getRuntime();
    if (!rt) {
      throw new Error('no ksu or mmrl runtime detected');
    }
    this.runtime = rt;
  }

  async readAll(): Promise<BatMonSnapshot> {
    const base = '/proc/batmon';
    const [info, battery, drain, history, events, tasks, deltas, cpu, psy, suspend, config] =
      await Promise.all(NODES.map((n) => this.runtime.read(`${base}/${n}`)));

    return {
      info: parseInfo(info),
      battery: parseBattery(battery),
      drain: parseDrain(drain),
      history: parseHistory(history.split('\n')),
      events: parseEvents(events.split('\n')),
      tasks: parseTasks(tasks.split('\n')),
      deltas: parseTasks(deltas.split('\n')),
      cpu: parseCpu(cpu.split('\n')),
      psy: parsePsy(psy.split('\n')),
      suspend: parseSuspend(suspend.split('\n')),
      config: parseConfig(config),
      fetchedAt: Date.now(),
    };
  }
}
