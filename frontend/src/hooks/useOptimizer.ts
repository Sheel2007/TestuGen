import { useState } from 'react';
import type { Schedule, OptimizationRequest } from '../types';
import { optimize } from '../api/client';

export function useOptimizer() {
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [error, setError] = useState('');
  const [meta, setMeta] = useState<{ numVariables: number; solver: string } | null>(null);

  async function runOptimize(request: OptimizationRequest) {
    setStatus('loading');
    setError('');
    try {
      const response = await optimize(request);
      setSchedules(response.schedules);
      setMeta({ numVariables: response.num_variables, solver: response.solver_used });
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

  return { status, schedules, selectedIndex, setSelectedIndex, error, meta, runOptimize };
}
