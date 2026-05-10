export function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const period = h >= 12 ? 'PM' : 'AM';
  const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${hour12}:${m.toString().padStart(2, '0')} ${period}`;
}

export function parseDays(days: string): string[] {
  const result: string[] = [];
  let i = 0;
  while (i < days.length) {
    if (i + 1 < days.length && (days[i] === 'T' && days[i + 1] === 'u')) {
      result.push('Tu');
      i += 2;
    } else if (i + 1 < days.length && (days[i] === 'T' && days[i + 1] === 'h')) {
      result.push('Th');
      i += 2;
    } else {
      result.push(days[i]);
      i += 1;
    }
  }
  return result;
}

export const DAY_ORDER = ['M', 'Tu', 'W', 'Th', 'F'];

export const COURSE_COLORS = [
  '#3B82F6',
  '#EF4444',
  '#10B981',
  '#F59E0B',
  '#8B5CF6',
  '#EC4899',
  '#06B6D4',
  '#F97316',
];
