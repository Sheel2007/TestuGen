import { useState, useEffect, useRef } from 'react';
import type { CourseResult } from '../types';
import { searchCourses } from '../api/client';

interface Props {
  selectedCourses: CourseResult[];
  onAdd: (course: CourseResult) => void;
  onRemove: (courseId: string) => void;
}

export function CourseSearch({ selectedCourses, onAdd, onRemove }: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<CourseResult[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [loading, setLoading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();
  const containerRef = useRef<HTMLDivElement>(null);
  const requestIdRef = useRef(0);

  useEffect(() => {
    if (query.length < 2) {
      setResults([]);
      setShowDropdown(false);
      return;
    }
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      const thisRequest = ++requestIdRef.current;
      setLoading(true);
      try {
        const data = await searchCourses(query);
        // Only update if this is still the latest request
        if (thisRequest === requestIdRef.current) {
          const filtered = data.filter(c => !selectedCourses.some(s => s.course_id === c.course_id));
          setResults(filtered);
          setShowDropdown(filtered.length > 0);
        }
      } catch {
        if (thisRequest === requestIdRef.current) {
          setResults([]);
        }
      }
      if (thisRequest === requestIdRef.current) {
        setLoading(false);
      }
    }, 200);
  }, [query, selectedCourses]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <div ref={containerRef} className="relative">
      <label className="block text-sm font-medium text-gray-300 mb-2">Add Courses</label>
      <input
        type="text"
        value={query}
        onChange={e => setQuery(e.target.value)}
        onFocus={() => results.length > 0 && setShowDropdown(true)}
        placeholder="Search courses (e.g., CMSC216, Calculus)..."
        className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
      />
      {loading && (
        <div className="absolute right-3 top-11 text-gray-400 text-sm flex items-center gap-1">
          <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </div>
      )}

      {showDropdown && results.length > 0 && (
        <div className="absolute z-10 w-full mt-1 bg-gray-800 border border-gray-600 rounded-lg shadow-lg max-h-60 overflow-y-auto">
          {results.map(course => (
            <button
              key={course.course_id}
              onClick={() => {
                onAdd(course);
                setQuery('');
                setShowDropdown(false);
              }}
              className="w-full text-left px-4 py-2 hover:bg-gray-700 text-white flex justify-between items-center"
            >
              <span>
                <span className="font-medium text-red-400">{course.course_id}</span>
                <span className="ml-2 text-gray-300">{course.name}</span>
              </span>
              <span className="text-gray-500 text-sm">{course.credits} cr</span>
            </button>
          ))}
        </div>
      )}

      {selectedCourses.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-3">
          {selectedCourses.map(course => (
            <span
              key={course.course_id}
              className="inline-flex items-center gap-1 px-3 py-1 bg-red-900/50 text-red-300 border border-red-700 rounded-full text-sm"
            >
              {course.course_id}
              <button
                onClick={() => onRemove(course.course_id)}
                className="ml-1 hover:text-white"
              >
                &times;
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
