import { useState } from 'react';
import type { Schedule, OptimizationRequest } from '../types';
import { optimize } from '../api/client';
import { useLocalStorage } from './useLocalStorage';

export function useOptimizer() {
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>(() => {
    try {
      const saved = localStorage.getItem('ts:schedules');
      if (saved) {
        const parsed = JSON.parse(saved);
        return parsed.length > 0 ? 'done' : 'idle';
      }
    } catch { /* ignore */ }
    return 'idle';
  });
  const [schedules, setSchedules] = useLocalStorage<Schedule[]>('ts:schedules', []);
  const [scheduleLabels, setScheduleLabels] = useLocalStorage<number[]>('ts:scheduleLabels', []);
  const [selectedIndex, setSelectedIndex] = useLocalStorage('ts:selectedIdx', 0);
  const [error, setError] = useState('');
  const [meta, setMeta] = useLocalStorage<{ numVariables: number; solver: string } | null>('ts:meta', null);
  const [warnings, setWarnings] = useState<string[]>([]);

  async function runOptimize(request: OptimizationRequest) {
    setStatus('loading');
    setError('');
    setWarnings([]);
    try {
      const response = await optimize(request);
      setSchedules(response.schedules);
      setScheduleLabels(response.schedules.map((_, i) => i + 1));
      setMeta({ numVariables: response.num_variables, solver: response.solver_used });
      setWarnings(response.warnings || []);
      setSelectedIndex(0);
      setStatus(response.schedules.length > 0 ? 'done' : 'error');
      if (response.schedules.length === 0) {
        setError('No valid schedules found. Try different courses or fewer constraints.');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Optimization failed');
      setStatus('error');
    }
  }

  function removeSchedule(index: number) {
    setSchedules(prev => {
      const next = prev.filter((_, i) => i !== index);
      if (next.length === 0) {
        setStatus('idle');
        setMeta(null);
      }
      return next;
    });
    setScheduleLabels(prev => prev.filter((_, i) => i !== index));
    setSelectedIndex(prev => {
      if (index < prev) return prev - 1;
      if (index === prev) return 0;
      return prev;
    });
  }

  function reset() {
    setStatus('idle');
    setSchedules([]);
    setScheduleLabels([]);
    setSelectedIndex(0);
    setError('');
    setWarnings([]);
    setMeta(null);
  }

  return { status, schedules, scheduleLabels, selectedIndex, setSelectedIndex, error, warnings, meta, runOptimize, reset, removeSchedule };
}
