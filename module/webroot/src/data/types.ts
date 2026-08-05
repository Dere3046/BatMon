export type BatteryStatus = 'unknown' | 'charging' | 'discharging' | 'not_charging' | 'full';

export interface HistorySample {
  time: string;
  uptimeS: number;
  capacity: number;
  voltageMv: number;
  currentMa: number;
  currentAvgMa: number;
  tempCx10: number;
  status: BatteryStatus;
}

export interface DrainData {
  capacity: number;
  voltageMv: number;
  currentMa: number;
  tempCx10: number;
  avgMa1m: number;
  rate1m: number | null;
  rate5m: number | null;
  rate15m: number | null;
  voltSlope1m: number | null;
}

export interface BatteryProps {
  capacity?: number;
  voltageMv?: number;
  currentMa?: number;
  currentAvgMa?: number;
  tempCx10?: number;
  status?: number;
  health?: number;
  chargeFullUa?: number;
  chargeCounterUa?: number;
  timeToEmptyS?: number;
}

export type EventType =
  'DROP' | 'DRAIN' | 'POWER' | 'GAUGE' | 'PLUG' | 'SUSPEND' | 'RESUME' | 'LOAD' | 'UNLOAD';

export interface TopProcess {
  comm: string;
  pid: number;
  uid: number;
  cpuMs: number;
  wake: number;
}

export interface BatMonEvent {
  time: string;
  uptimeS: number;
  type: EventType;
  capBefore: number;
  capAfter: number;
  voltBefore: number;
  voltAfter: number;
  currAvg: number;
  top: TopProcess[];
}

export interface TaskRow {
  pid: number;
  uid: number;
  comm: string;
  cpuMs: number;
  wake: number;
  sleep: string;
  nvcsw: number;
  nivcsw: number;
  rbytes: number;
  wbytes: number;
}

export interface CpuFreq {
  cpu: number;
  freqKHz: number;
  maxKHz: number;
}

export interface PsyInfo {
  name: string;
  status?: string;
  capacity?: number;
  voltageMv?: number;
  currentMa?: number;
  tempCx10?: number;
}

export interface SuspendEntry {
  time: string;
  durationMs: number | null;
}

export interface ConfigData {
  pollMs: number;
  jumpPct: number;
  ratePctMin: number;
  warnMa: number;
  dropMa: number;
  dropPctMin: number;
  enabled: boolean;
  logDmesg: boolean;
}

export interface InfoData {
  version: string;
  kernel: string;
  battery: string;
  pollMs: number;
  enabled: boolean;
  uptimeS: number;
}

export interface BatMonSnapshot {
  info: InfoData;
  battery: BatteryProps;
  drain: DrainData;
  history: HistorySample[];
  events: BatMonEvent[];
  tasks: TaskRow[];
  deltas: TaskRow[];
  cpu: CpuFreq[];
  psy: PsyInfo[];
  suspend: SuspendEntry[];
  config: ConfigData;
  fetchedAt: number;
}
