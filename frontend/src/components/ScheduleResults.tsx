import type { Schedule } from '../types';

interface Props {
  schedules: Schedule[];
  selectedIndex: number;
  onSelect: (i: number) => void;
  meta: { numVariables: number; solver: string } | null;
}

export function ScheduleResults({ schedules, selectedIndex, onSelect, meta }: Props) {
  if (schedules.length === 0) return null;

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-semibold text-white">Results</h3>
        {meta && (
          <span className="text-xs text-gray-500">
            {meta.numVariables} sections evaluated &middot; {meta.solver.toUpperCase()}
          </span>
        )}
      </div>
      <div className="grid grid-cols-1 gap-2">
        {schedules.map((schedule, i) => (
          <button
            key={i}
            onClick={() => onSelect(i)}
            className={`text-left p-4 rounded-lg border transition-all ${
              i === selectedIndex
                ? 'bg-red-900/30 border-red-600'
                : 'bg-gray-800 border-gray-700 hover:border-gray-500'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-white">Schedule {i + 1}</span>
              <span className={`text-xs px-2 py-0.5 rounded-full ${
                schedule.solver === 'qaoa'
                  ? 'bg-purple-900/50 text-purple-300 border border-purple-700'
                  : 'bg-blue-900/50 text-blue-300 border border-blue-700'
              }`}>
                {schedule.solver === 'qaoa' ? 'QAOA' : 'Classical'}
              </span>
            </div>
            <div className="flex gap-4 text-xs text-gray-400">
              <span>Avg Prof Rating: <span className="text-yellow-400">{schedule.professor_score.toFixed(2)}</span></span>
              <span>Score: <span className="text-green-400">{schedule.total_score.toFixed(1)}</span></span>
            </div>
            <div className="flex flex-wrap gap-1 mt-2">
              {schedule.sections.map(s => (
                <span key={s.section_id} className="text-xs px-2 py-0.5 bg-gray-700 rounded text-gray-300">
                  {s.section_id}
                </span>
              ))}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
