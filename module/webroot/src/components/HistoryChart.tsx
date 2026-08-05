import { memo, useMemo } from 'react';
import { Card, CardContent, Typography } from '@mui/material';
import type { EChartsOption } from 'echarts';
import type { BatMonSnapshot } from '../data/types';
import { useI18n } from '../i18n';
import { EChart, chartAxis } from './EChart';

export const HistoryChart = memo(function HistoryChart({ snap }: { snap: BatMonSnapshot }) {
  const { t } = useI18n();
  const option = useMemo((): EChartsOption => {
    const h = snap.history.slice().reverse();
    return {
      animation: false,
      backgroundColor: 'transparent',
      tooltip: { trigger: 'axis' },
      legend: {
        data: [t('history.capacity'), t('history.voltage'), t('history.current')],
        textStyle: { color: '#8ba1a8' },
        top: 0,
      },
      grid: { left: 8, right: 8, top: 36, bottom: 44, containLabel: true },
      xAxis: {
        type: 'category',
        data: h.map((s) => s.time),
        ...chartAxis,
      },
      yAxis: [
        {
          type: 'value',
          name: '%',
          ...chartAxis,
        },
        {
          type: 'value',
          name: 'mV / mA',
          ...chartAxis,
        },
      ],
      dataZoom: [
        { type: 'inside', start: 0, end: 100 },
        { type: 'slider', start: 0, end: 100, height: 18, bottom: 4 },
      ],
      series: [
        {
          name: t('history.capacity'),
          type: 'line',
          data: h.map((s) => s.capacity),
          smooth: true,
          symbol: 'none',
          lineStyle: { width: 2, color: '#69f0ae' },
          itemStyle: { color: '#69f0ae' },
          areaStyle: { color: 'rgba(105,240,174,0.08)' },
        },
        {
          name: t('history.voltage'),
          type: 'line',
          yAxisIndex: 1,
          data: h.map((s) => s.voltageMv),
          smooth: true,
          symbol: 'none',
          lineStyle: { width: 1.5, color: '#4dd0e1' },
          itemStyle: { color: '#4dd0e1' },
        },
        {
          name: t('history.current'),
          type: 'line',
          yAxisIndex: 1,
          data: h.map((s) => s.currentMa),
          smooth: true,
          symbol: 'none',
          lineStyle: { width: 1.5, color: '#b39ddb' },
          itemStyle: { color: '#b39ddb' },
        },
      ],
    };
  }, [snap.history, t]);

  return (
    <Card elevation={0}>
      <CardContent>
        <Typography variant="h6" sx={{ mb: 1 }}>
          {t('history.title')}
        </Typography>
        <EChart option={option} height={320} />
      </CardContent>
    </Card>
  );
});
