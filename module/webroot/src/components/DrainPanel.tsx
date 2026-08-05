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
  const fast = d.rate1m !== null && d.rate1m <= -1000;
  const na = t('drain.n_a');
  const pctPerMin = t('drain.percentPerMin');
  const mvPerMin = t('drain.mvPerMin');

  const hist = snap.history;
  let voltSlope: number | null = d.voltSlope1m !== null ? d.voltSlope1m / 10 : null;
  if (hist.length >= 2) {
    const newest = hist[hist.length - 1];
    const cutoff = newest.uptimeS - 300;
    let oldest = hist[0];
    for (let i = hist.length - 1; i >= 0; i--) {
      oldest = hist[i];
      if (hist[i].uptimeS <= cutoff) break;
    }
    const elMin = (newest.uptimeS - oldest.uptimeS) / 60;
    if (elMin >= 1) {
      voltSlope = Math.round(((newest.voltageMv - oldest.voltageMv) / elMin) * 10) / 10;
    }
  }

  const fmtRate = (rate: number | null): string => {
    if (rate === null) return na;
    const sign = rate < 0 ? '-' : '';
    return `${sign}${(Math.abs(rate) / 1000).toFixed(3)} ${pctPerMin}`;
  };

  const fmtSlope = (slope: number | null): string => {
    if (slope === null) return na;
    const sign = slope < 0 ? '' : '+';
    return `${sign}${slope.toFixed(1)} ${mvPerMin}`;
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
            warn={d.rate5m !== null && d.rate5m <= -600}
          />
          <RateBox label={t('drain.rate15m')} value={fmtRate(d.rate15m)} />
          <RateBox
            label={t('drain.avgCurrent')}
            value={`${d.avgMa1m} ${t('unit.ma')}`}
            warn={Math.abs(d.avgMa1m) >= 1000 && (d.rate1m ?? 0) < 0}
          />
          <RateBox label={t('drain.voltageSlope')} value={fmtSlope(voltSlope)} />
        </Stack>
      </CardContent>
    </Card>
  );
});
