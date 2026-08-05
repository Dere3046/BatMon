import { memo, useMemo, useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Chip,
  Collapse,
  IconButton,
  List,
  ListItem,
  ListItemText,
  Typography,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
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
  const [open, setOpen] = useState<Set<number>>(new Set());
  const sorted = useMemo(() => events.slice().reverse(), [events]);

  const toggle = (i: number) => {
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(i)) {
        next.delete(i);
      } else {
        next.add(i);
      }
      return next;
    });
  };

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
            {sorted.map((e, i) => {
              const expanded = open.has(i);
              return (
                <ListItem key={i} alignItems="flex-start" sx={{ px: 0, py: 0.5 }}>
                  <ListItemText
                    primary={
                      <Box
                        component="span"
                        onClick={() => toggle(i)}
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 1,
                          flexWrap: 'wrap',
                          cursor: 'pointer',
                        }}
                      >
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
                        {ANOMALY_TYPES.has(e.type) && !expanded && (
                          <Typography variant="caption" color="text.secondary">
                            {t('events.cap')} {capText(e.capBefore)} → {capText(e.capAfter)}% &nbsp;
                            {t('events.curr')} {e.currAvg}
                            {t('unit.ma')}
                          </Typography>
                        )}
                        {e.top.length > 0 && (
                          <IconButton size="small" sx={{ ml: 'auto' }}>
                            {expanded ? (
                              <ExpandLessIcon fontSize="small" />
                            ) : (
                              <ExpandMoreIcon fontSize="small" />
                            )}
                          </IconButton>
                        )}
                      </Box>
                    }
                    secondary={
                      <Collapse in={expanded} timeout="auto" unmountOnExit>
                        <Box component="span" sx={{ display: 'block', mt: 0.5 }}>
                          {ANOMALY_TYPES.has(e.type) && (
                            <Typography variant="caption" display="block" color="text.secondary">
                              {t('events.cap')} {capText(e.capBefore)} → {capText(e.capAfter)}%
                              &nbsp;{t('events.volt')} {capText(e.voltBefore)} →{' '}
                              {capText(e.voltAfter)}
                              {t('unit.mv')} &nbsp;{t('events.curr')} {e.currAvg}
                              {t('unit.ma')}
                            </Typography>
                          )}
                          {e.top.map((p, j) => (
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
                        </Box>
                      </Collapse>
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
