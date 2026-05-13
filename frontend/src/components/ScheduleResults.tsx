import type { Schedule } from '../types';
import { downloadICS } from '../utils/icsExport';

interface Props {
  schedules: Schedule[];
  scheduleLabels: number[];
  selectedIndex: number;
  onSelect: (i: number) => void;
  onRemove: (i: number) => void;
  semester: string;
  meta: { numVariables: number; solver: string } | null;
}

export function ScheduleResults({ schedules, scheduleLabels, selectedIndex, onSelect, onRemove, semester, meta }: Props) {
  if (schedules.length === 0) return null;

  const selected = schedules[selectedIndex];
  const selectedLabel = scheduleLabels[selectedIndex] ?? selectedIndex + 1;

  function handleRemove(e: React.MouseEvent, i: number) {
    e.stopPropagation();
    if (!window.confirm(`Remove Schedule ${scheduleLabels[i] ?? i + 1}?`)) return;
    onRemove(i);
  }

  function handleExport() {
    if (!selected) return;
    downloadICS(selected, semester, selectedLabel);
  }

  return (
    <div className="flex-shrink-0 border-b border-gray-800 bg-gray-900/60 px-4 py-2">
      {/* Single row: tabs | score details | export */}
      <div className="flex items-center gap-2">
        {/* Schedule tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto flex-shrink-0">
          {schedules.map((schedule, i) => (
            <div
              key={i}
              onClick={() => onSelect(i)}
              className={`flex-shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer ${
                i === selectedIndex
                  ? 'bg-red-600 text-white'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-gray-200'
              }`}
            >
              <span>
                Schedule {scheduleLabels[i] ?? i + 1}
                <span className={`ml-1 ${i === selectedIndex ? 'text-red-200' : 'text-gray-500'}`}>
                  {schedule.total_score.toFixed(0)}%
                </span>
              </span>
              <button
                onClick={(e) => handleRemove(e, i)}
                className={`w-4 h-4 flex items-center justify-center rounded-full text-[10px] leading-none transition-colors ${
                  i === selectedIndex
                    ? 'hover:bg-red-500 text-red-200'
                    : 'hover:bg-gray-600 text-gray-500'
                }`}
              >
                &times;
              </button>
            </div>
          ))}
        </div>

        {/* Divider */}
        {selected && <div className="w-px h-5 bg-gray-700 flex-shrink-0" />}

        {/* Score details */}
        {selected && (
          <div className="flex items-center gap-2.5 text-[11px] text-gray-500 flex-shrink-0">
            <span>★ <span className="text-yellow-400">{selected.avg_professor_rating.toFixed(1)}</span></span>
            {selected.pref_total_count > 0 && (
              <span className={selected.pref_match_count === selected.pref_total_count ? 'text-green-400' : 'text-orange-400'}>
                {selected.pref_match_count}/{selected.pref_total_count} pref
              </span>
            )}
            <span>Time <span className="text-blue-400">{selected.time_score.toFixed(0)}%</span></span>
            <span>Gap <span className="text-emerald-400">{selected.gap_score.toFixed(0)}%</span></span>
            <span className={`px-1.5 py-0.5 rounded text-[10px] ${
              selected.solver === 'qaoa'
                ? 'bg-purple-900/40 text-purple-400'
                : 'bg-blue-900/40 text-blue-400'
            }`}>
              {selected.solver === 'qaoa' ? 'QAOA' : 'Classical'}
            </span>
          </div>
        )}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Export button */}
        {selected && (
          <button
            onClick={handleExport}
            className="flex-shrink-0 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-200 rounded-md text-xs font-medium transition-colors flex items-center gap-1.5"
            title="Download .ics for Google/Apple/Outlook Calendar"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Export
          </button>
        )}
      </div>
    </div>
  );
}
