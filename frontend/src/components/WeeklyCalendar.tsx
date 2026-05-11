import type { Schedule } from '../types';
import { minutesToTime, parseDays, DAY_ORDER, COURSE_COLORS } from '../utils/timeUtils';

interface Props {
  schedule: Schedule | null;
}

const START_HOUR = 8;
const END_HOUR = 22;
const TOTAL_MINUTES = (END_HOUR - START_HOUR) * 60;
const HOUR_HEIGHT = 60;

export function WeeklyCalendar({ schedule }: Props) {
  if (!schedule) {
    return (
      <div className="flex items-center justify-center h-96 bg-gray-900 rounded-lg border border-gray-700">
        <p className="text-gray-500">Run the optimizer to see your schedule</p>
      </div>
    );
  }

  const courseColors: Record<string, string> = {};
  const uniqueCourses = [...new Set(schedule.sections.map(s => s.course_id))];
  uniqueCourses.forEach((cid, i) => {
    courseColors[cid] = COURSE_COLORS[i % COURSE_COLORS.length];
  });

  const hours = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i);

  return (
    <div className="bg-gray-900 rounded-lg border border-gray-700 overflow-hidden">
      <div className="grid grid-cols-[60px_repeat(5,1fr)] border-b border-gray-700">
        <div className="p-2 text-center text-xs text-gray-500 bg-gray-900"></div>
        {DAY_ORDER.map(day => (
          <div key={day} className="p-2 text-center text-sm font-medium text-gray-300 bg-gray-900 border-l border-gray-700">
            {day === 'M' ? 'Monday' : day === 'Tu' ? 'Tuesday' : day === 'W' ? 'Wednesday' : day === 'Th' ? 'Thursday' : 'Friday'}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-[60px_repeat(5,1fr)]" style={{ height: `${hours.length * HOUR_HEIGHT}px` }}>
        <div className="relative">
          {hours.map(h => (
            <div
              key={h}
              className="absolute w-full text-right pr-2 text-xs text-gray-500"
              style={{ top: `${(h - START_HOUR) * HOUR_HEIGHT}px`, height: HOUR_HEIGHT }}
            >
              {h > 12 ? h - 12 : h}{h >= 12 ? 'PM' : 'AM'}
            </div>
          ))}
        </div>

        {DAY_ORDER.map(day => (
          <div key={day} className="relative border-l border-gray-700">
            {hours.map(h => (
              <div
                key={h}
                className="absolute w-full border-t border-gray-800"
                style={{ top: `${(h - START_HOUR) * HOUR_HEIGHT}px`, height: HOUR_HEIGHT }}
              />
            ))}

            {schedule.sections.map((section) =>
              section.meetings
                .filter(m => parseDays(m.days).includes(day))
                .map((meeting, midx) => {
                  const top = ((meeting.start_time - START_HOUR * 60) / 60) * HOUR_HEIGHT;
                  const height = ((meeting.end_time - meeting.start_time) / 60) * HOUR_HEIGHT;
                  const color = courseColors[section.course_id];

                  return (
                    <div
                      key={`${section.section_id}-${midx}`}
                      className="absolute left-0.5 right-0.5 rounded-md px-1.5 py-1 overflow-hidden cursor-pointer group transition-all hover:z-10 hover:shadow-lg"
                      style={{
                        top: `${top}px`,
                        height: `${Math.max(height, 24)}px`,
                        backgroundColor: color + '33',
                        borderLeft: `3px solid ${color}`,
                      }}
                    >
                      <div className="text-xs font-semibold text-white truncate">{section.course_id} - {section.section_id.split('-').pop()}</div>
                      <div className="text-[10px] text-gray-300 truncate">
                        {meeting.building} {meeting.room}
                      </div>
                      {height > 35 && section.instructors.length > 0 && (
                        <div className="text-[10px] text-gray-400 truncate">
                          {section.instructors[0]}
                        </div>
                      )}
                      {height > 50 && (
                        <div className="text-[10px] text-gray-300 truncate">
                          {minutesToTime(meeting.start_time)} - {minutesToTime(meeting.end_time)}
                        </div>
                      )}

                      <div className="hidden group-hover:block absolute left-full top-0 ml-2 z-20 bg-gray-800 border border-gray-600 rounded-lg p-3 shadow-xl w-56">
                        <div className="font-semibold text-white">{section.course_id} - {section.section_id.split('-')[1]}</div>
                        <div className="text-sm text-gray-300 mt-1">{section.instructors.join(', ')}</div>
                        <div className="text-sm text-gray-400 mt-1">{meeting.building} {meeting.room}</div>
                        <div className="text-sm text-gray-400">{minutesToTime(meeting.start_time)} - {minutesToTime(meeting.end_time)}</div>
                        <div className="flex gap-3 mt-2 text-xs">
                          <span className="text-yellow-400">Rating: {section.professor_rating.toFixed(1)}</span>
                          <span className="text-green-400">GPA: {section.avg_gpa.toFixed(2)}</span>
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
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
