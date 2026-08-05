import { memo, useMemo } from 'react';
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
import type { BatMonEvent, EventType } from '../data/types';
import type { MessageKey } from '../i18n';
import { useI18n } from '../i18n';

const EVENT_COLORS: Record<
  EventType,
  'error' | 'warning' | 'success' | 'info' | 'secondary' | 'default'
> = {
  DROP: 'error',
  DRAIN: 'warning',
  POWER: 'warning',
  GAUGE: 'secondary',
  PLUG: 'info',
  SUSPEND: 'default',
  RESUME: 'success',
  LOAD: 'success',
  UNLOAD: 'default',
};

const ANOMALY_TYPES = new Set<EventType>(['DROP', 'DRAIN', 'POWER', 'GAUGE']);

function capText(v: number): string {
  return v < 0 ? '-' : String(v);
}

export const EventsPanel = memo(function EventsPanel({ events }: { events: BatMonEvent[] }) {
  const { t } = useI18n();
  const sorted = useMemo(() => events.slice().reverse(), [events]);

  return (
    <Card elevation={0}>
      <CardContent>
        <Typography variant="h6" sx={{ mb: 1 }}>
          {t('events.title')}
        </Typography>
        {sorted.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            {t('events.empty')}
          </Typography>
        ) : (
          <List dense disablePadding>
            {sorted.map((e, i) => (
              <ListItem
                key={i}
                divider={i < sorted.length - 1}
                alignItems="flex-start"
                sx={{ px: 0, py: 1 }}
              >
                <ListItemText
                  primary={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                      <Chip
                        size="small"
                        color={EVENT_COLORS[e.type]}
                        label={t(`event.${e.type}` as MessageKey)}
                      />
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{ fontVariantNumeric: 'tabular-nums' }}
                      >
                        {e.time}
                      </Typography>
                      {ANOMALY_TYPES.has(e.type) && (
                        <Typography variant="caption" color="text.secondary">
                          {t('events.cap')} {capText(e.capBefore)} → {capText(e.capAfter)}% &nbsp;
                          {t('events.volt')} {capText(e.voltBefore)} → {capText(e.voltAfter)}
                          {t('unit.mv')} &nbsp;{t('events.curr')} {e.currAvg}
                          {t('unit.ma')}
                        </Typography>
                      )}
                    </Box>
                  }
                  secondary={
                    e.top.length > 0 ? (
                      <Box component="span" sx={{ display: 'block', mt: 0.5 }}>
                        {e.top.slice(0, 3).map((p, j) => (
                          <Typography
                            key={j}
                            variant="caption"
                            display="block"
                            color="text.secondary"
                            sx={{ fontVariantNumeric: 'tabular-nums' }}
                          >
                            {p.comm} &nbsp;{t('events.pid')} {p.pid} &nbsp;{t('events.cpu')}{' '}
                            {p.cpuMs}
                            {t('unit.ms')} &nbsp;{t('events.wake')} {p.wake}
                          </Typography>
                        ))}
                        {e.top.length > 3 && (
                          <Typography variant="caption" color="text.secondary">
                            {t('events.more', { n: e.top.length - 3 })}
                          </Typography>
                        )}
                      </Box>
                    ) : undefined
                  }
                />
              </ListItem>
            ))}
          </List>
        )}
      </CardContent>
    </Card>
  );
});
