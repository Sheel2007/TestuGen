import React from 'react';
import { DAY_ORDER } from '../utils/timeUtils';

interface Props {
  noEarlyMorning: boolean;
  setNoEarlyMorning: (v: boolean) => void;
  noEvening: boolean;
  setNoEvening: (v: boolean) => void;
  lunchBreak: boolean;
  setLunchBreak: (v: boolean) => void;
  profWeight: number;
  setProfWeight: (v: number) => void;
  walkWeight: number;
  setWalkWeight: (v: number) => void;
  timeWeight: number;
  setTimeWeight: (v: number) => void;
  blockedSlots: Set<string>;
  toggleBlocked: (key: string) => void;
  solver: string;
  setSolver: (v: string) => void;
  semester: string;
  setSemester: (v: string) => void;
}

const HOURS = Array.from({ length: 14 }, (_, i) => 8 + i); // 8am to 9pm

export function PreferencesForm(props: Props) {
  const {
    noEarlyMorning, setNoEarlyMorning,
    noEvening, setNoEvening,
    lunchBreak, setLunchBreak,
    profWeight, setProfWeight,
    walkWeight, setWalkWeight,
    timeWeight, setTimeWeight,
    blockedSlots, toggleBlocked,
    solver, setSolver,
    semester, setSemester,
  } = props;

  return (
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">Semester</label>
        <select
          value={semester}
          onChange={e => setSemester(e.target.value)}
          className="w-full px-4 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-red-500"
        >
          <option value="202608">Fall 2026</option>
          <option value="202601">Spring 2026</option>
          <option value="202508">Fall 2025</option>
          <option value="202501">Spring 2025</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-300 mb-3">Block Out Times</label>
        <p className="text-xs text-gray-500 mb-2">Click cells to block time slots</p>
        <div className="overflow-x-auto">
          <div className="grid grid-cols-6 gap-px bg-gray-700 rounded-lg overflow-hidden" style={{ minWidth: '320px' }}>
            <div className="bg-gray-900 p-1 text-center text-xs text-gray-500"></div>
            {DAY_ORDER.map(day => (
              <div key={day} className="bg-gray-900 p-1 text-center text-xs font-medium text-gray-400">
                {day}
              </div>
            ))}
            {HOURS.map(hour => (
              <React.Fragment key={`row-${hour}`}>
                <div className="bg-gray-900 p-1 text-center text-xs text-gray-500">
                  {hour > 12 ? hour - 12 : hour}{hour >= 12 ? 'p' : 'a'}
                </div>
                {DAY_ORDER.map(day => {
                  const key = `${day}-${hour}`;
                  const isBlocked = blockedSlots.has(key);
                  return (
                    <button
                      key={key}
                      onClick={() => toggleBlocked(key)}
                      className={`p-1 text-xs transition-colors ${
                        isBlocked
                          ? 'bg-red-900/70 hover:bg-red-800'
                          : 'bg-gray-800 hover:bg-gray-700'
                      }`}
                    />
                  );
                })}
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={noEarlyMorning}
            onChange={e => setNoEarlyMorning(e.target.checked)}
            className="w-4 h-4 accent-red-500"
          />
          <span className="text-sm text-gray-300">Avoid early morning (before 9 AM)</span>
        </label>
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={noEvening}
            onChange={e => setNoEvening(e.target.checked)}
            className="w-4 h-4 accent-red-500"
          />
          <span className="text-sm text-gray-300">Avoid evening (after 5 PM)</span>
        </label>
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={lunchBreak}
            onChange={e => setLunchBreak(e.target.checked)}
            className="w-4 h-4 accent-red-500"
          />
          <span className="text-sm text-gray-300">Keep lunch free (11:30 AM - 1 PM)</span>
        </label>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-300 mb-3">Priority Weights</label>
        <div className="space-y-3">
          <div>
            <div className="flex justify-between text-xs text-gray-400 mb-1">
              <span>Professor Rating</span>
              <span>{Math.round(profWeight * 100)}%</span>
            </div>
            <input
              type="range"
              min="0" max="100" value={profWeight * 100}
              onChange={e => setProfWeight(Number(e.target.value) / 100)}
              className="w-full accent-red-500"
            />
          </div>
          <div>
            <div className="flex justify-between text-xs text-gray-400 mb-1">
              <span>Walking Distance</span>
              <span>{Math.round(walkWeight * 100)}%</span>
            </div>
            <input
              type="range"
              min="0" max="100" value={walkWeight * 100}
              onChange={e => setWalkWeight(Number(e.target.value) / 100)}
              className="w-full accent-red-500"
            />
          </div>
          <div>
            <div className="flex justify-between text-xs text-gray-400 mb-1">
              <span>Time Preferences</span>
              <span>{Math.round(timeWeight * 100)}%</span>
            </div>
            <input
              type="range"
              min="0" max="100" value={timeWeight * 100}
              onChange={e => setTimeWeight(Number(e.target.value) / 100)}
              className="w-full accent-red-500"
            />
          </div>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">Solver</label>
        <div className="flex gap-3">
          {(['qaoa', 'classical', 'both'] as const).map(s => (
            <button
              key={s}
              onClick={() => setSolver(s)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                solver === s
                  ? 'bg-red-600 text-white'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >
              {s === 'qaoa' ? 'QAOA' : s === 'classical' ? 'Classical' : 'Both'}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
