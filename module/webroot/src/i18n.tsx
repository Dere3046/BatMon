import { createContext, useContext, useState } from 'react';
import type { ReactNode } from 'react';

const en = {
  'app.title': 'BatMon',
  'app.language': 'Language',
  'app.noRuntime': 'no runtime detected, open from KernelSU, APatch or MMRL',
  'app.readError': 'failed to read telemetry',
  'app.moduleNotLoaded': 'module not loaded, check boot log or load manually',
  'battery.title': 'Battery',
  'battery.voltage': 'voltage',
  'battery.current': 'current',
  'battery.temperature': 'temperature',
  'battery.timeToEmpty': 'time to empty',
  'battery.status.charging': 'charging',
  'battery.status.discharging': 'discharging',
  'battery.status.full': 'full',
  'battery.status.not_charging': 'not charging',
  'battery.status.unknown': 'unknown',
  'history.title': 'History',
  'history.capacity': 'capacity',
  'history.voltage': 'voltage',
  'history.current': 'current',
  'cpu.title': 'CPU frequency',
  'cpu.current': 'current',
  'cpu.max': 'max',
  'drain.title': 'Drain rate',
  'drain.fast': 'fast drain',
  'drain.rate1m': '1 min',
  'drain.rate5m': '5 min',
  'drain.rate15m': '15 min',
  'drain.avgCurrent': 'avg current',
  'drain.voltageSlope': 'voltage slope',
  'drain.percentPerMin': '%/min',
  'drain.mvPerMin': 'mV/min',
  'drain.n_a': 'n/a',
  'events.title': 'Events',
  'events.empty': 'no events',
  'events.cap': 'cap',
  'events.volt': 'volt',
  'events.curr': 'curr',
  'events.more': '+{n} more',
  'events.pid': 'pid',
  'events.cpu': 'cpu',
  'events.wake': 'wake',
  'event.DROP': 'DROP',
  'event.DRAIN': 'DRAIN',
  'event.POWER': 'POWER',
  'event.GAUGE': 'GAUGE',
  'event.PLUG': 'PLUG',
  'event.SUSPEND': 'SUSPEND',
  'event.RESUME': 'RESUME',
  'event.LOAD': 'LOAD',
  'event.UNLOAD': 'UNLOAD',
  'tasks.title': 'Processes',
  'tasks.filter': 'filter comm',
  'tasks.comm': 'comm',
  'tasks.cpuMs': 'cpu ms',
  'tasks.wake': 'wake',
  'tasks.deltas': 'deltas',
  'tasks.tasks': 'tasks',
  'tasks.sleep': 'sleep',
  'tasks.nvcsw': 'nvcsw',
  'tasks.nivcsw': 'nivcsw',
  'tasks.read': 'read',
  'tasks.write': 'write',
  'tasks.pid': 'pid',
  'tasks.showing': 'showing {shown} of {total}',
  'config.title': 'Config',
  'config.poll': 'poll',
  'config.jumpPct': 'jump pct x100',
  'config.ratePctMin': 'rate %/min x100',
  'config.warnMa': 'warn current',
  'config.dropMa': 'gauge low current',
  'config.dropPctMin': 'gauge rate x100',
  'config.sampling': 'sampling',
  'config.logDmesg': 'log to dmesg',
  'config.readonly': 'read only in webui, change via shell',
  'config.applyHint': 'changes apply immediately',
  'tasks.empty': 'no process data',
  'tasks.noDeltas': 'no deltas yet, switch to tasks view',
  'unit.ms': 'ms',
  'unit.ma': 'mA',
  'unit.mv': 'mV',
  'unit.volt': 'V',
  'unit.celsius': '°C',
  'unit.hours': 'h',
  'unit.khz': 'kHz',
} as const;

export type MessageKey = keyof typeof en;

const zh: Record<MessageKey, string> = {
  'app.title': 'BatMon',
  'app.language': '语言',
  'app.noRuntime': '未检测到运行环境，请从 KernelSU、APatch 或 MMRL 打开',
  'app.readError': '读取遥测数据失败',
  'app.moduleNotLoaded': '模块未加载，请查看开机日志或手动加载',
  'battery.title': '电池',
  'battery.voltage': '电压',
  'battery.current': '电流',
  'battery.temperature': '温度',
  'battery.timeToEmpty': '剩余时长',
  'battery.status.charging': '充电中',
  'battery.status.discharging': '放电中',
  'battery.status.full': '已充满',
  'battery.status.not_charging': '未充电',
  'battery.status.unknown': '未知',
  'history.title': '历史曲线',
  'history.capacity': '容量',
  'history.voltage': '电压',
  'history.current': '电流',
  'cpu.title': 'CPU 频率',
  'cpu.current': '当前',
  'cpu.max': '最大',
  'drain.title': '掉电速率',
  'drain.fast': '掉电过快',
  'drain.rate1m': '1 分钟',
  'drain.rate5m': '5 分钟',
  'drain.rate15m': '15 分钟',
  'drain.avgCurrent': '平均电流',
  'drain.voltageSlope': '电压斜率',
  'drain.percentPerMin': '%/分',
  'drain.mvPerMin': '毫伏/分',
  'drain.n_a': '无数据',
  'events.title': '事件',
  'events.empty': '暂无事件',
  'events.cap': '容量',
  'events.volt': '电压',
  'events.curr': '电流',
  'events.more': '还有 {n} 个',
  'events.pid': 'PID',
  'events.cpu': 'CPU',
  'events.wake': '唤醒',
  'event.DROP': '骤降',
  'event.DRAIN': '快速放电',
  'event.POWER': '高功耗',
  'event.GAUGE': '估算异常',
  'event.PLUG': '充电切换',
  'event.SUSPEND': '休眠',
  'event.RESUME': '唤醒',
  'event.LOAD': '加载',
  'event.UNLOAD': '卸载',
  'tasks.title': '进程',
  'tasks.filter': '搜索进程',
  'tasks.comm': '进程名',
  'tasks.cpuMs': 'CPU 毫秒',
  'tasks.wake': '唤醒',
  'tasks.deltas': '增量',
  'tasks.tasks': '累计',
  'tasks.sleep': '休眠',
  'tasks.nvcsw': '主动切换',
  'tasks.nivcsw': '被动切换',
  'tasks.read': '读取',
  'tasks.write': '写入',
  'tasks.pid': 'PID',
  'tasks.showing': '显示 {shown} / {total}',
  'config.title': '配置',
  'config.poll': '采样间隔',
  'config.jumpPct': '单次跳变 x100',
  'config.ratePctMin': '速率 %/分 x100',
  'config.warnMa': '大电流告警',
  'config.dropMa': '估算异常低电流',
  'config.dropPctMin': '估算异常速率 x100',
  'config.sampling': '采样开关',
  'config.logDmesg': '写入 dmesg',
  'config.readonly': 'WebUI 只读，请通过 shell 修改',
  'config.applyHint': '修改立即生效',
  'tasks.empty': '无进程数据',
  'tasks.noDeltas': '暂无增量，可切换到累计视图',
  'unit.ms': '毫秒',
  'unit.ma': '毫安',
  'unit.mv': '毫伏',
  'unit.volt': 'V',
  'unit.celsius': '°C',
  'unit.hours': '小时',
  'unit.khz': '千赫',
};

export type Language = 'en' | 'zh';

const messages: Record<Language, Record<MessageKey, string>> = { en, zh };

const STORAGE_KEY = 'batmon.lang';

function detectLanguage(): Language {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'en' || saved === 'zh') return saved;
  } catch {
    /* storage unavailable */
  }
  try {
    return navigator.language.toLowerCase().startsWith('zh') ? 'zh' : 'en';
  } catch {
    return 'en';
  }
}

interface I18nContextValue {
  lang: Language;
  setLang: (l: Language) => void;
  t: (key: MessageKey, params?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Language>(detectLanguage);

  const setLang = (l: Language) => {
    setLangState(l);
    try {
      localStorage.setItem(STORAGE_KEY, l);
    } catch {
      /* storage unavailable */
    }
  };

  const t = (key: MessageKey, params?: Record<string, string | number>): string => {
    let s = messages[lang][key] ?? messages.en[key] ?? key;
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        s = s.replace(`{${k}}`, String(v));
      }
    }
    return s;
  };

  return <I18nContext.Provider value={{ lang, setLang, t }}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error('useI18n must be used inside I18nProvider');
  }
  return ctx;
}
