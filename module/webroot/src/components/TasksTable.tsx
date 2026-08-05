import { useMemo, useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  InputAdornment,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableSortLabel,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import type { TaskRow } from '../data/types';
import { useI18n } from '../i18n';

type SortKey = 'cpuMs' | 'wake' | 'rbytes' | 'wbytes' | 'pid';

function fmtBytes(n: number): string {
  if (n >= 1e9) return (n / 1e9).toFixed(2) + 'G';
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(0) + 'K';
  return String(n);
}

export function TasksTable({ tasks, deltas }: { tasks: TaskRow[]; deltas: TaskRow[] }) {
  const { t } = useI18n();
  const [view, setView] = useState<'deltas' | 'tasks'>('deltas');
  const [sortKey, setSortKey] = useState<SortKey>('cpuMs');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [query, setQuery] = useState('');

  const rows = useMemo(() => {
    const src = view === 'deltas' ? deltas : tasks;
    const filtered = query
      ? src.filter((r) => r.comm.toLowerCase().includes(query.toLowerCase()))
      : src;
    return filtered.slice().sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      const cmp =
        typeof av === 'number' && typeof bv === 'number'
          ? av - bv
          : String(av).localeCompare(String(bv));
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [view, tasks, deltas, sortKey, sortDir, query]);

  const onSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  const head = (label: string, key: SortKey) => (
    <TableCell align="right" size="small">
      <TableSortLabel active={sortKey === key} direction={sortDir} onClick={() => onSort(key)}>
        {label}
      </TableSortLabel>
    </TableCell>
  );

  return (
    <Card elevation={0}>
      <CardContent>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            mb: 1,
            gap: 1,
            flexWrap: 'wrap',
          }}
        >
          <Typography variant="h6">{t('tasks.title')}</Typography>
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            <TextField
              size="small"
              placeholder={t('tasks.filter')}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon fontSize="small" />
                    </InputAdornment>
                  ),
                },
              }}
              sx={{ width: 200 }}
            />
            <ToggleButtonGroup
              size="small"
              exclusive
              value={view}
              onChange={(_, v) => v && setView(v)}
            >
              <ToggleButton value="deltas">{t('tasks.deltas')}</ToggleButton>
              <ToggleButton value="tasks">{t('tasks.tasks')}</ToggleButton>
            </ToggleButtonGroup>
          </Box>
        </Box>
        <TableContainer>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell>{t('tasks.comm')}</TableCell>
                {head(t('tasks.cpuMs'), 'cpuMs')}
                {head(t('tasks.wake'), 'wake')}
                <TableCell align="right" size="small">
                  {t('tasks.sleep')}
                </TableCell>
                <TableCell align="right" size="small">
                  {t('tasks.nvcsw')}
                </TableCell>
                <TableCell align="right" size="small">
                  {t('tasks.nivcsw')}
                </TableCell>
                {head(t('tasks.read'), 'rbytes')}
                {head(t('tasks.write'), 'wbytes')}
                {head(t('tasks.pid'), 'pid')}
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.slice(0, 100).map((r, i) => (
                <TableRow key={i} hover>
                  <TableCell size="small" sx={{ fontFamily: 'ui-monospace, monospace' }}>
                    {r.comm}
                  </TableCell>
                  <TableCell align="right" size="small" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                    {r.cpuMs}
                  </TableCell>
                  <TableCell align="right" size="small" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                    {r.wake}
                  </TableCell>
                  <TableCell align="right" size="small" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                    {r.sleep}
                  </TableCell>
                  <TableCell align="right" size="small" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                    {r.nvcsw}
                  </TableCell>
                  <TableCell align="right" size="small" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                    {r.nivcsw}
                  </TableCell>
                  <TableCell align="right" size="small" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                    {fmtBytes(r.rbytes)}
                  </TableCell>
                  <TableCell align="right" size="small" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                    {fmtBytes(r.wbytes)}
                  </TableCell>
                  <TableCell
                    align="right"
                    size="small"
                    color="text.secondary"
                    sx={{ color: 'text.secondary' }}
                  >
                    {r.pid}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
        {rows.length > 100 && (
          <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
            {t('tasks.showing', { shown: Math.min(rows.length, 100), total: rows.length })}
          </Typography>
        )}
      </CardContent>
    </Card>
  );
}
