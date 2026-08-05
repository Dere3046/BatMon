import { memo } from 'react';
import {
  Box,
  Card,
  CardContent,
  Chip,
  List,
  ListItem,
  ListItemText,
  Typography,
} from '@mui/material';
import type { SuspendEntry } from '../data/types';
import { useI18n } from '../i18n';

function fmtHms(ms: number): string {
  const h = Math.floor(ms / 3600000);
  const m = Math.floor(ms / 60000) % 60;
  const s = Math.floor(ms / 1000) % 60;
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(h)}:${p(m)}:${p(s)}`;
}

export const SuspendPanel = memo(function SuspendPanel({ suspend }: { suspend: SuspendEntry[] }) {
  const { t } = useI18n();

  return (
    <Card elevation={0}>
      <CardContent>
        <Typography variant="h6" sx={{ mb: 1 }}>
          {t('suspend.title')}
        </Typography>
        {suspend.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            {t('events.empty')}
          </Typography>
        ) : (
          <List dense disablePadding>
            {suspend.slice(0, 30).map((e, i) => {
              const aborted = e.durationMs !== null && e.durationMs === 0;
              return (
                <ListItem key={i} sx={{ px: 0, py: 0.25 }}>
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          sx={{ fontVariantNumeric: 'tabular-nums' }}
                        >
                          {e.time}
                        </Typography>
                        {e.durationMs === null ? (
                          <Chip size="small" color="default" label={t('suspend.enter')} />
                        ) : (
                          <Chip
                            size="small"
                            color={aborted ? 'warning' : 'success'}
                            label={t('suspend.resume', { dur: fmtHms(e.durationMs) })}
                          />
                        )}
                        {aborted && (
                          <Typography variant="caption" color="warning.main">
                            {t('suspend.aborted')}
                          </Typography>
                        )}
                      </Box>
                    }
                  />
                </ListItem>
              );
            })}
          </List>
        )}
      </CardContent>
    </Card>
  );
});
