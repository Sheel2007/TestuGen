import type { Schedule } from '../types';
import { parseDays } from './timeUtils';

// Map semester code to approximate start/end dates
// Format: YYYYMM -> { start: first Monday of classes, end: last Friday }
const SEMESTER_DATES: Record<string, { start: string; end: string }> = {
  '202501': { start: '20250127', end: '20250516' },
  '202508': { start: '20250825', end: '20251212' },
  '202601': { start: '20260126', end: '20260515' },
  '202608': { start: '20260824', end: '20261211' },
};

// Map our day codes to iCal BYDAY codes
const DAY_TO_ICAL: Record<string, string> = {
  M: 'MO',
  Tu: 'TU',
  W: 'WE',
  Th: 'TH',
  F: 'FR',
};

// Map our day codes to JS Date day-of-week (0=Sun)
const DAY_TO_DOW: Record<string, number> = {
  M: 1,
  Tu: 2,
  W: 3,
  Th: 4,
  F: 5,
};

function pad2(n: number): string {
  return n.toString().padStart(2, '0');
}

function minutesToHHMM(minutes: number): string {
  return `${pad2(Math.floor(minutes / 60))}${pad2(minutes % 60)}00`;
}

// Find the first occurrence of a given weekday on or after a date
function firstOccurrence(startDate: string, dayCode: string): string {
  const year = parseInt(startDate.slice(0, 4));
  const month = parseInt(startDate.slice(4, 6)) - 1;
  const day = parseInt(startDate.slice(6, 8));
  const date = new Date(year, month, day);
  const targetDow = DAY_TO_DOW[dayCode];
  while (date.getDay() !== targetDow) {
    date.setDate(date.getDate() + 1);
  }
  return `${date.getFullYear()}${pad2(date.getMonth() + 1)}${pad2(date.getDate())}`;
}

function uid(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}@orbitterp`;
}

export function generateICS(schedule: Schedule, semester: string, label: number): string {
  const dates = SEMESTER_DATES[semester] || SEMESTER_DATES['202608'];
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//OrbitTerp//Schedule Export//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:OrbitTerp Schedule ${label}`,
    'X-WR-TIMEZONE:America/New_York',
    // Timezone definition for proper handling
    'BEGIN:VTIMEZONE',
    'TZID:America/New_York',
    'BEGIN:DAYLIGHT',
    'TZOFFSETFROM:-0500',
    'TZOFFSETTO:-0400',
    'TZNAME:EDT',
    'DTSTART:19700308T020000',
    'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU',
    'END:DAYLIGHT',
    'BEGIN:STANDARD',
    'TZOFFSETFROM:-0400',
    'TZOFFSETTO:-0500',
    'TZNAME:EST',
    'DTSTART:19701101T020000',
    'RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU',
    'END:STANDARD',
    'END:VTIMEZONE',
  ];

  for (const section of schedule.sections) {
    for (const meeting of section.meetings) {
      const days = parseDays(meeting.days);
      if (days.length === 0) continue;

      const icalDays = days.map(d => DAY_TO_ICAL[d]).filter(Boolean);
      if (icalDays.length === 0) continue;

      // Find first occurrence for DTSTART
      const firstDay = days[0];
      const eventDate = firstOccurrence(dates.start, firstDay);
      const startTime = minutesToHHMM(meeting.start_time);
      const endTime = minutesToHHMM(meeting.end_time);

      const instructor = section.instructors.length > 0 ? section.instructors[0] : 'TBA';
      const location = [meeting.building, meeting.room].filter(Boolean).join(' ');
      const sectionNum = section.section_id.split('-').pop() || '';

      lines.push(
        'BEGIN:VEVENT',
        `UID:${uid()}`,
        `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').split('.')[0]}Z`,
        `DTSTART;TZID=America/New_York:${eventDate}T${startTime}`,
        `DTEND;TZID=America/New_York:${eventDate}T${endTime}`,
        `RRULE:FREQ=WEEKLY;BYDAY=${icalDays.join(',')};UNTIL=${dates.end}T235959Z`,
        `SUMMARY:${section.course_id} - ${sectionNum}`,
        `DESCRIPTION:Instructor: ${instructor}\\nSection: ${sectionNum}\\nRating: ${section.professor_rating.toFixed(1)}/5.0\\nGPA: ${section.avg_gpa.toFixed(2)}`,
        `LOCATION:${location}`,
        'END:VEVENT',
      );
    }
  }

  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

export function downloadICS(schedule: Schedule, semester: string, label: number) {
  const content = generateICS(schedule, semester, label);
  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `orbitterp-schedule-${label}.ics`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
