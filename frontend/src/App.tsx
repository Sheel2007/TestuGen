import { useState, useCallback, useMemo } from 'react';
import type { CourseResult, OptimizationRequest, BlockedSlot } from './types';
import { CourseSearch } from './components/CourseSearch';
import { PreferencesForm } from './components/PreferencesForm';
import { WeeklyCalendar } from './components/WeeklyCalendar';
import { ScheduleResults } from './components/ScheduleResults';
import { AboutModal } from './components/AboutModal';
import { useOptimizer } from './hooks/useOptimizer';
import { useLocalStorage } from './hooks/useLocalStorage';
import { DAY_ORDER } from './utils/timeUtils';

function App() {
  const [selectedCourses, setSelectedCourses] = useLocalStorage<CourseResult[]>('ts:courses', []);
  const [professorPrefs, setProfessorPrefs] = useLocalStorage<Record<string, string>>('ts:profPrefs', {});
  const [semester, setSemester] = useLocalStorage('ts:semester', '202608');
  const [noEarlyMorning, setNoEarlyMorning] = useLocalStorage('ts:noEarly', true);
  const [noEvening, setNoEvening] = useLocalStorage('ts:noEvening', false);
  const [lunchBreak, setLunchBreak] = useLocalStorage('ts:lunch', true);
  const [earlyBefore, setEarlyBefore] = useLocalStorage('ts:earlyBefore', 9);
  const [eveningAfter, setEveningAfter] = useLocalStorage('ts:eveningAfter', 17);
  const [lunchStartHour, setLunchStartHour] = useLocalStorage('ts:lunchStart', 11);
  const [lunchEndHour, setLunchEndHour] = useLocalStorage('ts:lunchEnd', 13);
  const [minGap, setMinGap] = useLocalStorage<number | null>('ts:minGap', null);
  const [maxGap, setMaxGap] = useLocalStorage<number | null>('ts:maxGap', null);
  const [profWeight, setProfWeight] = useLocalStorage('ts:profWeight', 0.4);
  const [gapWeight, setGapWeight] = useLocalStorage('ts:gapWeight', 0.3);
  const [timeWeight, setTimeWeight] = useLocalStorage('ts:timeWeight', 0.3);
  const [blockedSlotsArray, setBlockedSlotsArray] = useLocalStorage<string[]>('ts:blocked', []);
  const [aboutOpen, setAboutOpen] = useState(false);

  // Convert stored array to Set for internal use
  const blockedSlots = useMemo(() => new Set(blockedSlotsArray), [blockedSlotsArray]);
  const setBlockedSlots = useCallback((updater: Set<string> | ((prev: Set<string>) => Set<string>)) => {
    setBlockedSlotsArray(prev => {
      const prevSet = new Set(prev);
      const next = updater instanceof Function ? updater(prevSet) : updater;
      return [...next];
    });
  }, [setBlockedSlotsArray]);

  const autoBlockedSlots = useMemo(() => {
    const auto = new Set<string>();
    DAY_ORDER.forEach(day => {
      if (noEarlyMorning) {
        for (let h = 8; h < earlyBefore; h++) auto.add(`${day}-${h}`);
      }
      if (noEvening) {
        for (let h = eveningAfter; h <= 21; h++) auto.add(`${day}-${h}`);
      }
      if (lunchBreak) {
        for (let h = lunchStartHour; h < lunchEndHour; h++) auto.add(`${day}-${h}`);
      }
    });
    return auto;
  }, [noEarlyMorning, noEvening, lunchBreak, earlyBefore, eveningAfter, lunchStartHour, lunchEndHour]);

  const allBlockedSlots = useMemo(() => {
    const merged = new Set(blockedSlots);
    autoBlockedSlots.forEach(s => merged.add(s));
    return merged;
  }, [blockedSlots, autoBlockedSlots]);

  const { status, schedules, scheduleLabels, selectedIndex, setSelectedIndex, error, warnings, meta, runOptimize, reset, removeSchedule } = useOptimizer();

  const handleAddCourse = useCallback((course: CourseResult) => {
    setSelectedCourses(prev => {
      if (prev.some(c => c.course_id === course.course_id)) return prev;
      return [...prev, course];
    });
  }, []);

  const handleRemoveCourse = useCallback((courseId: string) => {
    setSelectedCourses(prev => prev.filter(c => c.course_id !== courseId));
    setProfessorPrefs(prev => {
      const next = { ...prev };
      delete next[courseId];
      return next;
    });
  }, []);

  const handleProfessorChange = useCallback((courseId: string, professor: string) => {
    setProfessorPrefs(prev => {
      if (!professor) {
        const next = { ...prev };
        delete next[courseId];
        return next;
      }
      return { ...prev, [courseId]: professor };
    });
  }, []);

  const toggleBlocked = useCallback((key: string) => {
    setBlockedSlots(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  function handleClearAll() {
    if (!window.confirm('Clear all courses, preferences, and results? This cannot be undone.')) return;
    setSelectedCourses([]);
    setProfessorPrefs({});
    setNoEarlyMorning(true);
    setNoEvening(false);
    setLunchBreak(true);
    setEarlyBefore(9);
    setEveningAfter(17);
    setLunchStartHour(11);
    setLunchEndHour(13);
    setMinGap(null);
    setMaxGap(null);
    setProfWeight(0.4);
    setGapWeight(0.3);
    setTimeWeight(0.3);
    setBlockedSlots(new Set());
    reset();
  }

  function handleOptimize() {
    if (selectedCourses.length === 0) return;

    const blocked_times: BlockedSlot[] = [];
    allBlockedSlots.forEach(key => {
      const [day, hourStr] = key.split('-');
      const hour = parseInt(hourStr);
      blocked_times.push({
        day,
        start: `${hour}:00`,
        end: `${hour + 1}:00`,
      });
    });

    const total = profWeight + gapWeight + timeWeight || 1;

    const request: OptimizationRequest = {
      course_ids: selectedCourses.map(c => c.course_id),
      semester,
      professor_prefs: professorPrefs,
      preferences: {
        blocked_times,
        lunch_window: lunchBreak ? [`${lunchStartHour}:00`, `${lunchEndHour}:00`] : null,
        no_early_morning: noEarlyMorning,
        no_evening: noEvening,
        min_gap: minGap,
        max_gap: maxGap,
      },
      weights: {
        professor_rating: profWeight / total,
        gap_preference: gapWeight / total,
        time_preference: timeWeight / total,
      },
      num_results: 5,
      solver: 'both',
    };

    runOptimize(request);
  }

  const weightTotal = Math.round(profWeight * 100) + Math.round(gapWeight * 100) + Math.round(timeWeight * 100);
  const weightsValid = weightTotal === 100;

  const totalCredits = selectedCourses.reduce((sum, c) => {
    const n = parseInt(c.credits);
    return sum + (isNaN(n) ? 0 : n);
  }, 0);

  return (
    <div className="min-h-screen md:h-screen bg-gray-950 text-white flex flex-col md:overflow-hidden overflow-auto">
      {/* Header */}
      <header className="flex-shrink-0 border-b border-gray-800 bg-gray-900/80 backdrop-blur z-30">
        <div className="px-3 sm:px-5 py-2.5 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
            <div className="w-7 h-7 bg-red-600 rounded-md flex items-center justify-center font-bold text-xs">T</div>
            <h1 className="text-sm sm:text-base font-bold">TerpScheduler</h1>
          </div>
          <div className="flex items-center gap-3 sm:gap-6 text-sm overflow-x-auto">
            <button
              onClick={() => setAboutOpen(true)}
              className="text-gray-400 hover:text-white transition-colors text-sm sm:text-base bg-transparent border-none cursor-pointer flex-shrink-0"
            >
              About
            </button>
            <a
              href="https://github.com/Sheel2007/TestuGen"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-400 hover:text-white transition-colors text-sm sm:text-base flex-shrink-0 hidden sm:inline"
            >
              GitHub
            </a>
            <span className="text-gray-400 text-sm sm:text-base flex-shrink-0">Credits: <span className="font-semibold text-white">{totalCredits}</span></span>
            <select
              value={semester}
              onChange={e => setSemester(e.target.value)}
              className="px-2 sm:px-3 py-1 bg-gray-800 border border-gray-700 rounded-md text-xs sm:text-sm text-white focus:outline-none focus:ring-1 focus:ring-red-500 flex-shrink-0"
            >
              <option value="202608">Fall 2026</option>
              <option value="202601">Spring 2026</option>
              <option value="202508">Fall 2025</option>
              <option value="202501">Spring 2025</option>
            </select>
          </div>
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1 flex flex-col md:flex-row md:overflow-hidden">
        {/* Left sidebar — full width on mobile, fixed width on desktop */}
        <aside className="w-full md:w-[320px] flex-shrink-0 border-b md:border-b-0 md:border-r border-gray-800 bg-gray-900/40 md:overflow-y-auto">
          <div className="p-3 sm:p-4 space-y-4">
            {/* Course search */}
            <CourseSearch
              selectedCourses={selectedCourses}
              onAdd={handleAddCourse}
              onRemove={handleRemoveCourse}
              professorPrefs={professorPrefs}
              onProfessorChange={handleProfessorChange}
              semester={semester}
            />

            {/* Divider */}
            <div className="border-t border-gray-800" />

            {/* Filters */}
            <PreferencesForm
              noEarlyMorning={noEarlyMorning} setNoEarlyMorning={setNoEarlyMorning}
              noEvening={noEvening} setNoEvening={setNoEvening}
              lunchBreak={lunchBreak} setLunchBreak={setLunchBreak}
              earlyBefore={earlyBefore} setEarlyBefore={setEarlyBefore}
              eveningAfter={eveningAfter} setEveningAfter={setEveningAfter}
              lunchStartHour={lunchStartHour} setLunchStartHour={setLunchStartHour}
              lunchEndHour={lunchEndHour} setLunchEndHour={setLunchEndHour}
              minGap={minGap} setMinGap={setMinGap}
              maxGap={maxGap} setMaxGap={setMaxGap}
              profWeight={profWeight} setProfWeight={setProfWeight}
              gapWeight={gapWeight} setGapWeight={setGapWeight}
              timeWeight={timeWeight} setTimeWeight={setTimeWeight}
              weightTotal={weightTotal} weightsValid={weightsValid}
              blockedSlots={blockedSlots} toggleBlocked={toggleBlocked}
              autoBlockedSlots={autoBlockedSlots}
            />

            {/* Optimize + Clear buttons */}
            <div className="flex gap-2">
              <button
                onClick={handleOptimize}
                disabled={selectedCourses.length === 0 || status === 'loading' || !weightsValid}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 disabled:bg-gray-700 disabled:text-gray-500 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                {status === 'loading' ? (
                  <>
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Optimizing...
                  </>
                ) : (
                  'Optimize Schedule'
                )}
              </button>
              <button
                onClick={handleClearAll}
                className="px-3 py-2.5 bg-gray-700 hover:bg-gray-600 text-gray-300 text-sm rounded-lg transition-colors"
                title="Clear all"
              >
                Clear
              </button>
            </div>
          </div>
        </aside>

        {/* Right: schedule tabs + calendar */}
        <div className="flex-1 flex flex-col md:overflow-hidden">
          {/* Warnings & errors — top of main area so users always see them */}
          {(error || warnings.length > 0) && (
            <div className="flex-shrink-0 px-3 sm:px-4 pt-2 space-y-1.5">
              {error && (
                <div className="bg-red-900/30 border border-red-700 rounded-lg px-3 py-2 text-xs text-red-300">
                  {error}
                </div>
              )}
              {warnings.length > 0 && (
                <div className="bg-yellow-900/30 border border-yellow-700 rounded-lg px-3 py-2 text-xs text-yellow-300 space-y-0.5">
                  {warnings.map((w, i) => <div key={i}>⚠ {w}</div>)}
                </div>
              )}
            </div>
          )}

          {/* Schedule tabs */}
          <ScheduleResults
            schedules={schedules}
            scheduleLabels={scheduleLabels}
            selectedIndex={selectedIndex}
            onSelect={setSelectedIndex}
            onRemove={removeSchedule}
            semester={semester}
            meta={meta}
          />

          {/* Calendar */}
          <div className="flex-1 overflow-auto p-2 sm:p-4">
            <WeeklyCalendar schedule={schedules[selectedIndex] ?? null} />
          </div>
        </div>
      </div>

      {/* About modal */}
      <AboutModal open={aboutOpen} onClose={() => setAboutOpen(false)} />
    </div>
  );
}

export default App;
