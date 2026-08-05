import type {
  BatMonEvent,
  BatteryProps,
  BatteryStatus,
  ConfigData,
  CpuFreq,
  DrainData,
  EventType,
  HistorySample,
  InfoData,
  PsyInfo,
  SuspendEntry,
  TaskRow,
  TopProcess,
} from './types';

const STATUS_NAMES = ['unknown', 'charging', 'discharging', 'not_charging', 'full'] as const;

const EVENT_NAMES = [
  'DROP',
  'DRAIN',
  'POWER',
  'GAUGE',
  'PLUG',
  'SUSPEND',
  'RESUME',
  'LOAD',
  'UNLOAD',
] as const;

export function parseStatus(name: string): BatteryStatus {
  if ((STATUS_NAMES as readonly string[]).includes(name)) {
    return name as BatteryStatus;
  }
  return 'unknown';
}

export function parseHistory(lines: string[]): HistorySample[] {
  const out: HistorySample[] = [];
  for (const line of lines) {
    const m = line.match(
      /^(\d{2}:\d{2}:\d{2})\s+(\d+)\s+(\d+|-)\s+(\d+)\s+(-?\d+)\s+(-?\d+)\s+(-?\d+)\s+(\w+)$/,
    );
    if (!m) continue;
    out.push({
      time: m[1],
      uptimeS: Number(m[2]),
      capacity: m[3] === '-' ? -1 : Number(m[3]),
      voltageMv: Number(m[4]),
      currentMa: Number(m[5]),
      currentAvgMa: Number(m[6]),
      tempCx10: Number(m[7]),
      status: parseStatus(m[8]),
    });
  }
  return out;
}

export function parseDrain(text: string): DrainData {
  const get = (key: string): string | null => {
    const m = text.match(new RegExp(`^${key}\\s+(.*)$`, 'm'));
    return m ? m[1] : null;
  };
  const rate = (v: string | null): number | null => {
    if (!v || v === 'n/a') return null;
    return Math.round(Number(v.replace('%/min', '')) * 100);
  };
  const slopeRaw = get('volt_slope_1m');
  return {
    capacity: Number(get('capacity') ?? '-1'),
    voltageMv: Number(get('voltage_mv') ?? 0),
    currentMa: Number(get('current_ma') ?? 0),
    tempCx10: Number(get('temp_cx10') ?? 0),
    avgMa1m: Number(get('avg_ma_1m') ?? 0),
    rate1m: rate(get('rate_1m')),
    rate5m: rate(get('rate_5m')),
    rate15m: rate(get('rate_15m')),
    voltSlope1m:
      slopeRaw === null || slopeRaw === 'n/a'
        ? null
        : Math.round(Number(slopeRaw.replace(' mv/min', '')) * 10),
  };
}

export function parseBattery(text: string): BatteryProps {
  const out: BatteryProps = {};
  for (const line of text.split('\n')) {
    const m = line.match(/^(\w+)\s+(-?\d+)$/);
    if (!m) continue;
    switch (m[1]) {
      case 'capacity':
        out.capacity = Number(m[2]);
        break;
      case 'voltage_mv':
        out.voltageMv = Number(m[2]);
        break;
      case 'current_ma':
        out.currentMa = Number(m[2]);
        break;
      case 'current_avg_ma':
        out.currentAvgMa = Number(m[2]);
        break;
      case 'temp_cx10':
        out.tempCx10 = Number(m[2]);
        break;
      case 'status':
        out.status = Number(m[2]);
        break;
      case 'health':
        out.health = Number(m[2]);
        break;
      case 'charge_full_ua':
        out.chargeFullUa = Number(m[2]);
        break;
      case 'charge_counter_ua':
        out.chargeCounterUa = Number(m[2]);
        break;
      case 'time_to_empty_s':
        out.timeToEmptyS = Number(m[2]);
        break;
    }
  }
  return out;
}

function parseTopLine(line: string): TopProcess | null {
  const m = line.match(/^\s{2}(.+?)\s+pid\s+(\d+)\s+uid\s+(\d+)\s+cpu\s+(\d+)ms\s+wake\s+(\d+)$/);
  if (!m) return null;
  return {
    comm: m[1],
    pid: Number(m[2]),
    uid: Number(m[3]),
    cpuMs: Number(m[4]),
    wake: Number(m[5]),
  };
}

export function parseEvents(lines: string[]): BatMonEvent[] {
  const out: BatMonEvent[] = [];
  let current: BatMonEvent | null = null;
  for (const line of lines) {
    const head = line.match(
      /^(\d{2}:\d{2}:\d{2})\s+(\d+)\s+(\w+)\s+cap\s+(\d+|-)->(\d+|-)\s+volt\s+(\d+|-)->(\d+|-)\s+curr\s+(-?\d+)$/,
    );
    if (head) {
      current = {
        time: head[1],
        uptimeS: Number(head[2]),
        type: (EVENT_NAMES as readonly string[]).includes(head[3])
          ? (head[3] as EventType)
          : 'LOAD',
        capBefore: head[4] === '-' ? -1 : Number(head[4]),
        capAfter: head[5] === '-' ? -1 : Number(head[5]),
        voltBefore: head[6] === '-' ? -1 : Number(head[6]),
        voltAfter: head[7] === '-' ? -1 : Number(head[7]),
        currAvg: Number(head[8]),
        top: [],
      };
      out.push(current);
      continue;
    }
    if (current) {
      const top = parseTopLine(line);
      if (top) current.top.push(top);
    }
  }
  return out;
}

const TASK_RE =
  /^\s*(\d+)\s+(\d+)\s+(.+?)\s+cpu_ms\s+(\d+)\s+wake\s+(\d+)\s+sleep\s+(\d{2}:\d{2}:\d{2})\s+nvcsw\s+(\d+)\s+nivcsw\s+(\d+)\s+r\s+(\d+)\s+w\s+(\d+)$/;

export function parseTasks(lines: string[]): TaskRow[] {
  const out: TaskRow[] = [];
  for (const line of lines) {
    const m = line.match(TASK_RE);
    if (!m) continue;
    out.push({
      pid: Number(m[1]),
      uid: Number(m[2]),
      comm: m[3],
      cpuMs: Number(m[4]),
      wake: Number(m[5]),
      sleep: m[6],
      nvcsw: Number(m[7]),
      nivcsw: Number(m[8]),
      rbytes: Number(m[9]),
      wbytes: Number(m[10]),
    });
  }
  return out;
}

export function parseCpu(lines: string[]): CpuFreq[] {
  const out: CpuFreq[] = [];
  for (const line of lines) {
    const m = line.match(/^cpu(\d+)\s+(\d+)\s+(\d+)$/);
    if (!m) continue;
    out.push({
      cpu: Number(m[1]),
      freqKHz: Number(m[2]),
      maxKHz: Number(m[3]),
    });
  }
  return out;
}

export function parsePsy(lines: string[]): PsyInfo[] {
  const out: PsyInfo[] = [];
  let current: PsyInfo | null = null;
  for (const line of lines) {
    const head = line.match(/^\[(\w+)\]$/);
    if (head) {
      current = { name: head[1] };
      out.push(current);
      continue;
    }
    if (!current) continue;
    const m = line.match(/^(\w+)\s+(\d+|-?\d+|\w+)$/);
    if (!m) continue;
    switch (m[1]) {
      case 'status':
        current.status = m[2];
        break;
      case 'capacity':
        current.capacity = Number(m[2]);
        break;
      case 'voltage_mv':
        current.voltageMv = Number(m[2]);
        break;
      case 'current_ma':
        current.currentMa = Number(m[2]);
        break;
      case 'temp_cx10':
        current.tempCx10 = Number(m[2]);
        break;
    }
  }
  return out;
}

export function parseSuspend(lines: string[]): SuspendEntry[] {
  const out: SuspendEntry[] = [];
  for (const line of lines) {
    const resume = line.match(/^(\d{2}:\d{2}:\d{2}) resume after (\d{2}:\d{2}:\d{2})$/);
    if (resume) {
      out.push({
        time: resume[1],
        durationMs: hmsToMs(resume[2]),
      });
      continue;
    }
    const suspend = line.match(/^(\d{2}:\d{2}:\d{2}) suspend$/);
    if (suspend) {
      out.push({ time: suspend[1], durationMs: null });
    }
  }
  return out;
}

function hmsToMs(hms: string): number {
  const [h, m, s] = hms.split(':').map(Number);
  return (h * 3600 + m * 60 + s) * 1000;
}

export function parseConfig(text: string): ConfigData {
  const get = (key: string): string | null => {
    const m = text.match(new RegExp(`^${key}\\s+(\\S+)$`, 'm'));
    return m ? m[1] : null;
  };
  return {
    pollMs: Number(get('poll_ms') ?? 5000),
    jumpPct: Number(get('jump_pct') ?? 200),
    ratePctMin: Number(get('rate_pct_min') ?? 100),
    warnMa: Number(get('warn_ma') ?? 1000),
    dropMa: Number(get('drop_ma') ?? 150),
    dropPctMin: Number(get('drop_pct_min') ?? 300),
    enabled: (get('enabled') ?? '1') === '1',
    logDmesg: (get('log_dmesg') ?? '0') === '1',
  };
}

export function parseInfo(text: string): InfoData {
  const get = (key: string): string | null => {
    const m = text.match(new RegExp(`^${key}\\s+(\\S+)$`, 'm'));
    return m ? m[1] : null;
  };
  return {
    version: get('version') ?? '?',
    kernel: get('kernel') ?? '?',
    battery: get('battery') ?? 'none',
    pollMs: Number(get('poll_ms') ?? 5000),
    enabled: (get('enabled') ?? '1') === '1',
    uptimeS: Number(get('uptime_s') ?? 0),
  };
}
