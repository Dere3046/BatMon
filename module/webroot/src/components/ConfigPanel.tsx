import { Card, CardContent, Grid2 as Grid, Switch, TextField, Typography } from '@mui/material';
import type { ConfigData } from '../data/types';
import { useI18n } from '../i18n';

interface ConfigPanelProps {
  config: ConfigData;
}

function NumField({ label, value, unit }: { label: string; value: number; unit?: string }) {
  return (
    <TextField
      size="small"
      label={label}
      type="number"
      value={value}
      slotProps={{
        input: {
          endAdornment: unit ? (
            <Typography variant="caption" color="text.secondary">
              {unit}
            </Typography>
          ) : undefined,
        },
      }}
    />
  );
}

export function ConfigPanel({ config }: ConfigPanelProps) {
  const { t } = useI18n();
  return (
    <Card elevation={0}>
      <CardContent>
        <Typography variant="h6" sx={{ mb: 2 }}>
          {t('config.title')}
        </Typography>
        <Grid container spacing={2}>
          <Grid size={{ xs: 6, sm: 4 }}>
            <NumField label={t('config.poll')} value={config.pollMs} unit={t('unit.ms')} />
          </Grid>
          <Grid size={{ xs: 6, sm: 4 }}>
            <NumField label={t('config.jumpPct')} value={config.jumpPct} />
          </Grid>
          <Grid size={{ xs: 6, sm: 4 }}>
            <NumField label={t('config.ratePctMin')} value={config.ratePctMin} />
          </Grid>
          <Grid size={{ xs: 6, sm: 4 }}>
            <NumField label={t('config.warnMa')} value={config.warnMa} unit={t('unit.ma')} />
          </Grid>
          <Grid size={{ xs: 6, sm: 4 }}>
            <NumField label={t('config.dropMa')} value={config.dropMa} unit={t('unit.ma')} />
          </Grid>
          <Grid size={{ xs: 6, sm: 4 }}>
            <NumField label={t('config.dropPctMin')} value={config.dropPctMin} />
          </Grid>
          <Grid size={{ xs: 6 }}>
            <Typography variant="body2" color="text.secondary">
              {t('config.sampling')}
            </Typography>
            <Switch checked={config.enabled} disabled />
          </Grid>
          <Grid size={{ xs: 6 }}>
            <Typography variant="body2" color="text.secondary">
              {t('config.logDmesg')}
            </Typography>
            <Switch checked={config.logDmesg} disabled />
          </Grid>
        </Grid>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
          {t('config.readonly')}
        </Typography>
      </CardContent>
    </Card>
  );
}
