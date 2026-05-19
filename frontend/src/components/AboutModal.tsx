interface Props {
  open: boolean;
  onClose: () => void;
}

export function AboutModal({ open, onClose }: Props) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Modal */}
      <div
        className="relative bg-gray-900 border border-gray-700 rounded-xl shadow-2xl max-w-lg w-full mx-3 sm:mx-4 max-h-[85vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 w-7 h-7 flex items-center justify-center rounded-full text-gray-400 hover:text-white hover:bg-gray-700 transition-colors"
        >
          &times;
        </button>

        <div className="p-6 space-y-5">
          {/* Title */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-red-600 rounded-lg flex items-center justify-center font-bold text-sm">R</div>
            <h2 className="text-xl font-bold">About Registerp</h2>
          </div>

          {/* Description */}
          <p className="text-gray-300 text-sm leading-relaxed">
            Registerp helps University of Maryland students build the best possible class schedule.
            You pick your courses and preferences, and it finds schedules that balance professor ratings,
            time gaps, and your availability using a quantum-inspired optimization algorithm (QAOA)
            alongside a classical solver.
          </p>

          {/* How to Use */}
          <div>
            <h3 className="text-sm font-semibold text-white mb-2">How to Use</h3>
            <ol className="text-gray-400 text-sm space-y-2 list-none">
              <li className="flex gap-2.5 items-start">
                <span className="w-5 h-5 rounded-full bg-red-600 text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">1</span>
                <span><span className="text-gray-200 font-medium">Search for courses</span> — type a course name or ID (e.g. CMSC216, MATH241) in the search bar and click to add them</span>
              </li>
              <li className="flex gap-2.5 items-start">
                <span className="w-5 h-5 rounded-full bg-red-600 text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">2</span>
                <span><span className="text-gray-200 font-medium">Set preferences</span> — choose preferred professors from the dropdown, block out times on the grid, and adjust time filters like lunch break or early morning</span>
              </li>
              <li className="flex gap-2.5 items-start">
                <span className="w-5 h-5 rounded-full bg-red-600 text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">3</span>
                <span><span className="text-gray-200 font-medium">Click Optimize</span> — the app runs two solvers to find the best schedules that fit your preferences and avoid time conflicts</span>
              </li>
              <li className="flex gap-2.5 items-start">
                <span className="w-5 h-5 rounded-full bg-red-600 text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">4</span>
                <span><span className="text-gray-200 font-medium">Compare results</span> — click through the schedule tabs to compare options. Each one shows professor ratings, time scores, and gap scores</span>
              </li>
              <li className="flex gap-2.5 items-start">
                <span className="w-5 h-5 rounded-full bg-red-600 text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">5</span>
                <span><span className="text-gray-200 font-medium">Export</span> — download your favorite schedule as a .ics file to import into Google Calendar, Apple Calendar, or Outlook</span>
              </li>
            </ol>
          </div>

          {/* Inspiration */}
          <div>
            <h3 className="text-sm font-semibold text-white mb-1.5">Inspiration</h3>
            <p className="text-gray-400 text-sm leading-relaxed">
              Registerp was heavily inspired by{' '}
              <a href="https://jupiterp.com" target="_blank" rel="noopener noreferrer" className="text-red-400 hover:text-red-300 underline">Jupiterp</a>
              {' '}and also draws some inspiration from{' '}
              <a href="https://planetterp.com" target="_blank" rel="noopener noreferrer" className="text-red-400 hover:text-red-300 underline">PlanetTerp</a>.
            </p>
          </div>

          {/* Data Sources */}
          <div>
            <h3 className="text-sm font-semibold text-white mb-1.5">Data Sources</h3>
            <ul className="text-gray-400 text-sm space-y-1">
              <li>
                <a href="https://umd.io" target="_blank" rel="noopener noreferrer" className="text-red-400 hover:text-red-300 underline">umd.io</a>
                {' '}&mdash; Course sections, meeting times, rooms, and buildings
              </li>
              <li>
                <a href="https://planetterp.com" target="_blank" rel="noopener noreferrer" className="text-red-400 hover:text-red-300 underline">PlanetTerp</a>
                {' '}&mdash; Professor ratings and grade distributions
              </li>
              <li>
                <a href="https://jupiterp.com" target="_blank" rel="noopener noreferrer" className="text-red-400 hover:text-red-300 underline">Jupiterp</a>
                {' '}&mdash; Professor names and seat availability
              </li>
            </ul>
          </div>

          {/* Open Source */}
          <div>
            <h3 className="text-sm font-semibold text-white mb-1.5">Open Source</h3>
            <p className="text-gray-400 text-sm leading-relaxed">
              Registerp is completely open source. Check out the code on{' '}
              <a href="https://github.com/Sheel2007/TestuGen" target="_blank" rel="noopener noreferrer" className="text-red-400 hover:text-red-300 underline">GitHub</a>.
            </p>
          </div>

          {/* Team */}
          <div>
            <h3 className="text-sm font-semibold text-white mb-2">Team</h3>
            <div className="flex items-center gap-4">
              {/* Photo placeholder */}
              <div className="w-16 h-16 rounded-full bg-gray-700 border-2 border-gray-600 flex items-center justify-center text-gray-500 text-xs flex-shrink-0 overflow-hidden">
                <img
                  src="/team/sheel.jpg"
                  alt="Sheel Shah"
                  className="w-full h-full object-cover"
                  onError={e => {
                    (e.target as HTMLImageElement).style.display = 'none';
                    (e.target as HTMLImageElement).parentElement!.innerHTML = '<span class="text-gray-500 text-lg font-semibold">SS</span>';
                  }}
                />
              </div>
              <div>
                <p className="text-white text-sm font-medium">Sheel Shah</p>
                <p className="text-gray-500 text-xs">Creator &amp; Developer</p>
                <a
                  href="https://github.com/Sheel2007"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-red-400 hover:text-red-300 text-xs underline"
                >
                  GitHub
                </a>
              </div>
            </div>
          </div>

          {/* Built with Claude */}
          <p className="text-gray-600 text-xs text-center pt-2 border-t border-gray-800">
            Built with the help of{' '}
            <a href="https://claude.ai" target="_blank" rel="noopener noreferrer" className="text-gray-500 hover:text-gray-400 underline">Claude</a>
          </p>

          {/* Disclaimer */}
          <p className="text-gray-600 text-[11px] text-center">
            Registerp is not affiliated with the University of Maryland.
          </p>
        </div>
      </div>
    </div>
  );
}
