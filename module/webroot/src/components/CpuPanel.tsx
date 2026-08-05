import { memo, useMemo } from 'react';
import { Card, CardContent, Typography } from '@mui/material';
import type { EChartsOption } from 'echarts';
import type { CpuFreq } from '../data/types';
import { useI18n } from '../i18n';
import { EChart, chartAxis } from './EChart';

export const CpuPanel = memo(function CpuPanel({ cpu }: { cpu: CpuFreq[] }) {
  const { t } = useI18n();
  const option = useMemo((): EChartsOption => {
    return {
      animation: false,
      backgroundColor: 'transparent',
      tooltip: { trigger: 'axis' },
      legend: {
        data: [t('cpu.current'), t('cpu.max')],
        textStyle: { color: '#8ba1a8' },
        top: 0,
      },
      grid: { left: 8, right: 8, top: 36, bottom: 8, containLabel: true },
      xAxis: {
        type: 'category',
        data: cpu.map((c) => 'cpu' + c.cpu),
        ...chartAxis,
      },
      yAxis: {
        type: 'value',
        name: t('unit.khz'),
        ...chartAxis,
      },
      series: [
        {
          name: t('cpu.current'),
          type: 'bar',
          data: cpu.map((c) => c.freqKHz),
          barMaxWidth: 22,
          itemStyle: { color: '#4dd0e1', borderRadius: [4, 4, 0, 0] },
        },
        {
          name: t('cpu.max'),
          type: 'bar',
          data: cpu.map((c) => c.maxKHz),
          barMaxWidth: 22,
          itemStyle: { color: 'rgba(139,161,168,0.25)', borderRadius: [4, 4, 0, 0] },
        },
      ],
    };
  }, [cpu, t]);

  return (
    <Card elevation={0}>
      <CardContent>
        <Typography variant="h6" sx={{ mb: 1 }}>
          {t('cpu.title')}
        </Typography>
        <EChart option={option} height={200} />
      </CardContent>
    </Card>
  );
});
