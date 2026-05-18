import type { ChangeDirection } from '../types';

export const formatCount = (n: number): string => {
  if (n >= 10000) return `${(n / 1000).toFixed(1)}k`;
  if (n >= 1000) return `${(n / 1000).toFixed(2)}k`;
  return String(n);
};

export const formatChange = (pct: number): string => {
  const sign = pct > 0 ? '+' : pct < 0 ? '−' : '';
  return `${sign}${Math.abs(pct).toFixed(1)}%`;
};

export const changeDirection = (pct: number): ChangeDirection => {
  if (pct > 0.05) return 'up';
  if (pct < -0.05) return 'down';
  return 'flat';
};

export const formatDate = (iso: string): string => {
  const d = new Date(iso);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${mm}.${dd}`;
};

export const normalizeNameQuery = (q: string): string =>
  q.trim().toLowerCase().replace(/\s+/g, '');

export const formatDateTime = (iso: string): string => {
  const d = new Date(iso);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${mm}.${dd} ${hh}:${mi}`;
};
