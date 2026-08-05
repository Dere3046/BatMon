import { useEffect, useRef } from 'react';
import * as echarts from 'echarts';

interface EChartProps {
  option: echarts.EChartsOption;
  height?: number;
}

export function EChart({ option, height = 300 }: EChartProps) {
  const elRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    const el = elRef.current;
    if (!el) return;
    const chart = echarts.init(el, 'dark');
    chartRef.current = chart;
    const ro = new ResizeObserver(() => chart.resize());
    ro.observe(el);
    return () => {
      ro.disconnect();
      chart.dispose();
      chartRef.current = null;
    };
  }, []);

  useEffect(() => {
    chartRef.current?.setOption(option, { notMerge: true, lazyUpdate: true });
  }, [option]);

  return <div ref={elRef} style={{ height, width: '100%' }} />;
}

export const chartAxis = {
  axisLine: { lineStyle: { color: 'rgba(139,161,168,0.35)' } },
  axisLabel: { color: '#8ba1a8' },
  splitLine: { lineStyle: { color: 'rgba(139,161,168,0.1)' } },
} as const;
