import { memo, useMemo } from 'react';
import { Box, Card, CardContent, Chip, Stack, Typography } from '@mui/material';
import BatteryChargingFullIcon from '@mui/icons-material/BatteryChargingFull';
import BoltIcon from '@mui/icons-material/Bolt';
import ThermostatIcon from '@mui/icons-material/Thermostat';
import TimelineIcon from '@mui/icons-material/Timeline';
import type { EChartsOption } from 'echarts';
import type { BatMonSnapshot } from '../data/types';
import type { MessageKey } from '../i18n';
import { useI18n } from '../i18n';
import { EChart } from './EChart';

function StatCard({
  icon,
  label,
  value,
  unit,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  unit?: string;
  accent?: string;
}) {
  return (
    <Card elevation={0}>
      <CardContent>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
          <Box sx={{ color: accent ?? 'primary.main', display: 'flex' }}>{icon}</Box>
          <Typography variant="caption" color="text.secondary">
            {label}
          </Typography>
        </Stack>
        <Typography variant="h5" fontWeight={700} sx={{ color: accent ?? 'text.primary' }}>
          {value}
          {unit && (
            <Typography component="span" variant="body2" color="text.secondary" sx={{ ml: 0.5 }}>
              {unit}
            </Typography>
          )}
        </Typography>
      </CardContent>
    </Card>
  );
}

export const BatterySummary = memo(function BatterySummary({ snap }: { snap: BatMonSnapshot }) {
  const { t } = useI18n();
  const b = snap.battery;
  const cap = b.capacity ?? 0;
  const statusKey: MessageKey =
    b.status === 1
      ? 'battery.status.charging'
      : b.status === 2
        ? 'battery.status.discharging'
        : b.status === 4
          ? 'battery.status.full'
          : b.status === 3
            ? 'battery.status.not_charging'
            : 'battery.status.unknown';
  const statusColor: 'success' | 'warning' | 'error' | 'default' =
    b.status === 1 || b.status === 4
      ? 'success'
      : b.status === 2
        ? 'warning'
        : b.status === 3
          ? 'error'
          : 'default';
  const voltV = ((b.voltageMv ?? 0) / 1000).toFixed(3);

  const raw = b.currentMa ?? 0;
  const cur = String(raw);

  const temp = ((b.tempCx10 ?? 0) / 10).toFixed(1);
  const rate = snap.drain.rate1m ?? snap.drain.rate5m ?? snap.drain.rate15m;
  const tteHours =
    b.timeToEmptyS !== undefined && b.timeToEmptyS > 0
      ? (b.timeToEmptyS / 3600).toFixed(1)
      : cap > 0 && rate !== null && rate < 0
        ? (cap / (Math.abs(rate) / 1000) / 60).toFixed(1)
        : null;

  const gauge = useMemo((): EChartsOption => {
    return {
      animation: false,
      series: [
        {
          type: 'gauge',
          startAngle: 210,
          endAngle: -30,
          min: 0,
          max: 100,
          radius: '100%',
          center: ['50%', '62%'],
          progress: {
            show: true,
            width: 10,
            itemStyle: { color: cap <= 15 ? '#ff6e6e' : cap <= 35 ? '#ffd54f' : '#69f0ae' },
          },
          axisLine: { lineStyle: { width: 10, color: [[1, 'rgba(139,161,168,0.15)']] } },
          axisTick: { show: false },
          splitLine: { show: false },
          axisLabel: { show: false },
          pointer: { show: false },
          anchor: { show: false },
          title: { show: false },
          detail: {
            formatter: '{value}%',
            color: '#dbe7ea',
            fontSize: 26,
            fontWeight: 700,
            offsetCenter: [0, 0],
          },
          data: [{ value: cap }],
        },
      ],
    };
  }, [cap]);

  return (
    <Card elevation={0}>
      <CardContent>
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
          <Stack direction="row" spacing={1} alignItems="center">
            <BatteryChargingFullIcon color="primary" />
            <Typography variant="h6">{t('battery.title')}</Typography>
          </Stack>
          <Chip size="small" color={statusColor} label={t(statusKey)} />
        </Stack>
        <Box sx={{ height: 130 }}>
          <EChart option={gauge} height={130} />
        </Box>
        <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" sx={{ mt: 1 }}>
          <Box sx={{ flex: 1, minWidth: 120 }}>
            <StatCard
              icon={<BoltIcon />}
              label={t('battery.voltage')}
              value={voltV}
              unit={t('unit.volt')}
            />
          </Box>
          <Box sx={{ flex: 1, minWidth: 120 }}>
            <StatCard
              icon={<BatteryChargingFullIcon />}
              label={t('battery.current')}
              value={cur}
              unit={t('unit.ma')}
            />
          </Box>
          <Box sx={{ flex: 1, minWidth: 120 }}>
            <StatCard
              icon={<ThermostatIcon />}
              label={t('battery.temperature')}
              value={temp}
              unit={t('unit.celsius')}
            />
          </Box>
          <Box sx={{ flex: 1, minWidth: 120 }}>
            <StatCard
              icon={<TimelineIcon />}
              label={t('battery.timeToEmpty')}
              value={tteHours ?? '-'}
              unit={tteHours ? t('unit.hours') : undefined}
            />
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );
});
