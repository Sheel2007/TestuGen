import type { Schedule } from '../types';
import { minutesToTime, parseDays, DAY_ORDER, COURSE_COLORS } from '../utils/timeUtils';

interface Props {
  schedule: Schedule | null;
}

const START_HOUR = 8;
const END_HOUR = 22;

const DAY_LABELS_FULL: Record<string, string> = { M: 'Mon', Tu: 'Tue', W: 'Wed', Th: 'Thu', F: 'Fri' };
const DAY_LABELS_SHORT: Record<string, string> = { M: 'M', Tu: 'T', W: 'W', Th: 'R', F: 'F' };

export function WeeklyCalendar({ schedule }: Props) {
  if (!schedule) {
    return (
      <div className="flex items-center justify-center h-full px-4">
        <div className="max-w-sm text-center space-y-6">
          <div>
            <div className="w-12 h-12 bg-red-600/20 rounded-xl flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-white mb-1">Get Started</h2>
            <p className="text-gray-500 text-xs">Build your ideal schedule in a few steps</p>
          </div>
          <div className="space-y-3 text-left">
            <div className="flex gap-3 items-start">
              <span className="w-6 h-6 rounded-full bg-red-600 text-white text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">1</span>
              <div>
                <p className="text-sm text-gray-200 font-medium">Search for courses</p>
                <p className="text-xs text-gray-500">Type a course name or ID (e.g. CMSC216) in the search bar on the left</p>
              </div>
            </div>
            <div className="flex gap-3 items-start">
              <span className="w-6 h-6 rounded-full bg-red-600 text-white text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">2</span>
              <div>
                <p className="text-sm text-gray-200 font-medium">Set your preferences</p>
                <p className="text-xs text-gray-500">Pick preferred professors, block out times, and adjust filters</p>
              </div>
            </div>
            <div className="flex gap-3 items-start">
              <span className="w-6 h-6 rounded-full bg-red-600 text-white text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">3</span>
              <div>
                <p className="text-sm text-gray-200 font-medium">Click Optimize</p>
                <p className="text-xs text-gray-500">The app finds the best schedules based on professor ratings, time gaps, and your preferences</p>
              </div>
            </div>
            <div className="flex gap-3 items-start">
              <span className="w-6 h-6 rounded-full bg-red-600 text-white text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">4</span>
              <div>
                <p className="text-sm text-gray-200 font-medium">Compare and export</p>
                <p className="text-xs text-gray-500">Browse top schedules, then export to Google Calendar, Apple Calendar, or Outlook</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const courseColors: Record<string, string> = {};
  const uniqueCourses = [...new Set(schedule.sections.map(s => s.course_id))];
  uniqueCourses.forEach((cid, i) => {
    courseColors[cid] = COURSE_COLORS[i % COURSE_COLORS.length];
  });

  const hours = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i);
  // Smaller cells on mobile
  const hourHeight = typeof window !== 'undefined' && window.innerWidth < 640 ? 40 : 56;
  const timeColWidth = typeof window !== 'undefined' && window.innerWidth < 640 ? 32 : 50;

  return (
    <div className="h-full min-w-0">
      {/* Day headers */}
      <div className={`grid border-b border-gray-800 sticky top-0 bg-gray-950 z-10`}
        style={{ gridTemplateColumns: `${timeColWidth}px repeat(5, 1fr)` }}
      >
        <div />
        {DAY_ORDER.map(day => (
          <div key={day} className="py-1.5 sm:py-2 text-center text-[10px] sm:text-xs font-medium text-gray-400 border-l border-gray-800">
            <span className="hidden sm:inline">{DAY_LABELS_FULL[day]}</span>
            <span className="sm:hidden">{DAY_LABELS_SHORT[day]}</span>
          </div>
        ))}
      </div>

      {/* Time grid */}
      <div className="grid" style={{ gridTemplateColumns: `${timeColWidth}px repeat(5, 1fr)`, height: `${hours.length * hourHeight}px` }}>
        {/* Hour labels */}
        <div className="relative">
          {hours.map(h => (
            <div
              key={h}
              className="absolute w-full text-right pr-1 sm:pr-2 text-[8px] sm:text-[10px] text-gray-600"
              style={{ top: `${(h - START_HOUR) * hourHeight}px`, height: hourHeight }}
            >
              {h > 12 ? h - 12 : h}<span className="hidden sm:inline">{h >= 12 ? ' PM' : ' AM'}</span><span className="sm:hidden">{h >= 12 ? 'p' : 'a'}</span>
            </div>
          ))}
        </div>

        {/* Day columns */}
        {DAY_ORDER.map(day => (
          <div key={day} className="relative border-l border-gray-800/60">
            {hours.map(h => (
              <div
                key={h}
                className="absolute w-full border-t border-gray-800/40"
                style={{ top: `${(h - START_HOUR) * hourHeight}px`, height: hourHeight }}
              />
            ))}

            {schedule.sections.map((section) =>
              section.meetings
                .filter(m => parseDays(m.days).includes(day))
                .map((meeting, midx) => {
                  const top = ((meeting.start_time - START_HOUR * 60) / 60) * hourHeight;
                  const height = ((meeting.end_time - meeting.start_time) / 60) * hourHeight;
                  const color = courseColors[section.course_id];

                  return (
                    <div
                      key={`${section.section_id}-${midx}`}
                      className="absolute left-0.5 right-0.5 rounded px-0.5 sm:px-1.5 py-0.5 overflow-hidden cursor-pointer group transition-all hover:z-10 hover:brightness-125 hover:shadow-lg"
                      style={{
                        top: `${top}px`,
                        height: `${Math.max(height, 20)}px`,
                        backgroundColor: color + '30',
                        borderLeft: `3px solid ${color}`,
                      }}
                    >
                      <div className="text-[9px] sm:text-[11px] font-semibold text-white truncate leading-tight">
                        {section.course_id}
                      </div>
                      {height > 25 && (
                        <div className="text-[8px] sm:text-[9px] text-gray-300 truncate leading-tight">
                          {section.section_id.split('-').pop()} · {meeting.building} {meeting.room}
                        </div>
                      )}
                      {height > 35 && section.instructors.length > 0 && (
                        <div className="hidden sm:block text-[9px] text-gray-400 truncate leading-tight">
                          {section.instructors[0]}
                        </div>
                      )}
                      {height > 48 && (
                        <div className="hidden sm:block text-[9px] text-gray-500 truncate leading-tight">
                          {minutesToTime(meeting.start_time)} - {minutesToTime(meeting.end_time)}
                        </div>
                      )}

                      {/* Hover tooltip — desktop only */}
                      <div className="hidden md:group-hover:block absolute left-full top-0 ml-2 z-20 bg-gray-800 border border-gray-600 rounded-lg p-3 shadow-xl w-52 pointer-events-none">
                        <div className="font-semibold text-white text-xs">{section.course_id} - {section.section_id.split('-')[1]}</div>
                        <div className="text-xs text-gray-300 mt-1">{section.instructors.join(', ')}</div>
                        <div className="text-xs text-gray-400 mt-1">{meeting.building} {meeting.room}</div>
                        <div className="text-xs text-gray-400">{minutesToTime(meeting.start_time)} - {minutesToTime(meeting.end_time)}</div>
                        <div className="flex gap-3 mt-2 text-[10px]">
                          <span className="text-yellow-400">★ {section.professor_rating.toFixed(1)}</span>
                          <span className="text-green-400">GPA: {section.avg_gpa.toFixed(2)}</span>
                        </div>
                        <div className="text-[10px] text-gray-500 mt-0.5">
                          Seats: {section.open_seats}/{section.total_seats}
                        </div>
                      </div>
                    </div>
                  );
                })
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
