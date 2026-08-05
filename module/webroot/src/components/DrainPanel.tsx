import { memo } from 'react';
import { Card, CardContent, Stack, Typography } from '@mui/material';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import type { BatMonSnapshot } from '../data/types';
import { useI18n } from '../i18n';

function RateBox({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <Stack spacing={0.5}>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography
        variant="h6"
        fontWeight={700}
        sx={{ color: warn ? 'error.main' : 'text.primary', fontVariantNumeric: 'tabular-nums' }}
      >
        {value}
      </Typography>
    </Stack>
  );
}

export const DrainPanel = memo(function DrainPanel({ snap }: { snap: BatMonSnapshot }) {
  const { t } = useI18n();
  const d = snap.drain;
  const fast = d.rate1m !== null && d.rate1m <= -100;
  const na = t('drain.n_a');
  const pctPerMin = t('drain.percentPerMin');
  const mvPerMin = t('drain.mvPerMin');

  const fmtRate = (rate: number | null): string => {
    if (rate === null) return na;
    const sign = rate < 0 ? '' : '+';
    return `${sign}${(rate / 100).toFixed(2)} ${pctPerMin}`;
  };

  const fmtSlope = (slope: number | null): string => {
    if (slope === null) return na;
    return `${(slope / 10).toFixed(1)} ${mvPerMin}`;
  };

  return (
    <Card elevation={0}>
      <CardContent>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
          <TrendingDownIcon color={fast ? 'error' : 'primary'} />
          <Typography variant="h6">{t('drain.title')}</Typography>
          {fast && (
            <Typography variant="caption" color="error.main" fontWeight={700}>
              {t('drain.fast')}
            </Typography>
          )}
        </Stack>
        <Stack direction="row" spacing={4} useFlexGap flexWrap="wrap">
          <RateBox label={t('drain.rate1m')} value={fmtRate(d.rate1m)} warn={fast} />
          <RateBox
            label={t('drain.rate5m')}
            value={fmtRate(d.rate5m)}
            warn={d.rate5m !== null && d.rate5m <= -60}
          />
          <RateBox label={t('drain.rate15m')} value={fmtRate(d.rate15m)} />
          <RateBox
            label={t('drain.avgCurrent')}
            value={`${d.avgMa1m} ${t('unit.ma')}`}
            warn={d.avgMa1m <= -1000}
          />
          <RateBox label={t('drain.voltageSlope')} value={fmtSlope(d.voltSlope1m)} />
        </Stack>
      </CardContent>
    </Card>
  );
});
