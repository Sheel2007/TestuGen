import type { CourseResult, OptimizationRequest, OptimizationResponse } from '../types';

const API_BASE = 'http://localhost:8000/api';

export async function searchCourses(query: string): Promise<CourseResult[]> {
  if (!query || query.length < 2) return [];
  const res = await fetch(`${API_BASE}/courses/search?q=${encodeURIComponent(query)}`);
  if (!res.ok) return [];
  return res.json();
}

export async function optimize(request: OptimizationRequest): Promise<OptimizationResponse> {
  const res = await fetch(`${API_BASE}/optimize`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Optimization failed' }));
    throw new Error(err.detail || 'Optimization failed');
  }
  return res.json();
}
