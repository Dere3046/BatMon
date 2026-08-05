import { useEffect, useRef, useState } from 'react';
import {
  AppBar,
  Box,
  CircularProgress,
  Container,
  Grid2 as Grid,
  MenuItem,
  Select,
  Stack,
  Toolbar,
  Typography,
} from '@mui/material';
import BatterySaverIcon from '@mui/icons-material/BatterySaver';
import type { BatMonSnapshot, ConfigData } from './data/types';
import type { DataSource } from './data/source';
import { ProcSource } from './data/source';
import type { Language } from './i18n';
import { useI18n } from './i18n';
import { BatterySummary } from './components/BatterySummary';
import { HistoryChart } from './components/HistoryChart';
import { DrainPanel } from './components/DrainPanel';
import { CpuPanel } from './components/CpuPanel';
import { EventsPanel } from './components/EventsPanel';
import { TasksTable } from './components/TasksTable';
import { ConfigPanel } from './components/ConfigPanel';

const POLL_MS = 5000;
const CHART_REFRESH_MS = 20000;

export function App() {
  const { t, lang, setLang } = useI18n();
  const [snap, setSnap] = useState<BatMonSnapshot | null>(null);
  const [chartSnap, setChartSnap] = useState<BatMonSnapshot | null>(null);
  const [config, setConfig] = useState<ConfigData | null>(null);
  const [source, setSource] = useState<DataSource | null>(null);
  const [error, setError] = useState<string | null>(null);
  const lastChartRef = useRef(0);

  useEffect(() => {
    let cancelled = false;
    try {
      const s = new ProcSource();
      if (!cancelled) setSource(s);
    } catch {
      if (!cancelled) setError(t('app.noRuntime'));
    }
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!source) return;
    let cancelled = false;
    const tick = async () => {
      try {
        const s = await source.readAll();
        if (!cancelled) {
          setSnap(s);
          setConfig(s.config);
          const now = Date.now();
          if (now - lastChartRef.current >= CHART_REFRESH_MS) {
            lastChartRef.current = now;
            setChartSnap(s);
          }
          setError(null);
        }
      } catch (e) {
        if (!cancelled) {
          const msg = String(e);
          if (/no such file|not found/i.test(msg)) {
            setError(t('app.moduleNotLoaded'));
          } else {
            setError(`${t('app.readError')}: ${msg}`);
          }
        }
      }
    };
    tick();
    const id = setInterval(tick, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [source, t]);

  const chartData = chartSnap ?? snap;

  const onConfigChange = (values: Partial<ConfigData>) => {
    setConfig((prev) => (prev ? { ...prev, ...values } : prev));
    if (source) {
      source.setConfig(values).catch((e) => {
        setError(`${t('app.readError')}: ${String(e)}`);
      });
    }
  };

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      <AppBar
        position="sticky"
        elevation={0}
        color="transparent"
        sx={{ bgcolor: 'background.default', borderBottom: '1px solid', borderColor: 'divider' }}
      >
        <Toolbar variant="dense">
          <BatterySaverIcon sx={{ mr: 1.5, color: 'primary.main' }} />
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            {t('app.title')}
          </Typography>
          {snap && (
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ fontVariantNumeric: 'tabular-nums', mr: 1 }}
            >
              {snap.info.kernel}
            </Typography>
          )}
          <Select
            size="small"
            value={lang}
            onChange={(e) => setLang(e.target.value as Language)}
            variant="outlined"
            sx={{ minWidth: 88 }}
          >
            <MenuItem value="en">English</MenuItem>
            <MenuItem value="zh">中文</MenuItem>
          </Select>
        </Toolbar>
      </AppBar>
      <Container maxWidth="xl" sx={{ py: 2 }}>
        {error && (
          <Typography color="error" variant="body2" sx={{ mb: 1 }}>
            {error}
          </Typography>
        )}
        {!snap && !error && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}>
            <CircularProgress />
          </Box>
        )}
        {snap && (
          <Stack spacing={2}>
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, lg: 4 }}>
                <BatterySummary snap={snap} />
              </Grid>
              <Grid size={{ xs: 12, lg: 8 }}>
                <Stack spacing={2}>
                  <DrainPanel snap={snap} />
                  <CpuPanel cpu={snap.cpu} />
                </Stack>
              </Grid>
            </Grid>
            <HistoryChart snap={chartData!} />
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, lg: 6 }}>
                <EventsPanel events={snap.events} />
              </Grid>
              <Grid size={{ xs: 12, lg: 6 }}>
                {config && <ConfigPanel config={config} onChange={onConfigChange} />}
              </Grid>
            </Grid>
            <TasksTable tasks={snap.tasks} deltas={snap.deltas} />
          </Stack>
        )}
      </Container>
    </Box>
  );
}
