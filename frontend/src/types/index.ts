export interface Meeting {
  days: string;
  start_time: number;
  end_time: number;
  building: string;
  room: string;
}

export interface Section {
  section_id: string;
  course_id: string;
  instructors: string[];
  meetings: Meeting[];
  professor_rating: number;
  avg_gpa: number;
  total_seats: number;
  open_seats: number;
}

export interface Schedule {
  sections: Section[];
  total_score: number;
  professor_score: number;
  walking_score: number;
  time_score: number;
  solver: string;
}

export interface OptimizationResponse {
  schedules: Schedule[];
  num_variables: number;
  solver_used: string;
}

export interface CourseResult {
  course_id: string;
  name: string;
  credits: string;
  dept_id: string;
}

export interface BlockedSlot {
  day: string;
  start: string;
  end: string;
}

export interface OptimizationRequest {
  course_ids: string[];
  semester: string;
  preferences: {
    blocked_times: BlockedSlot[];
    lunch_window: string[] | null;
    no_early_morning: boolean;
    no_evening: boolean;
  };
  weights: {
    professor_rating: number;
    walking_distance: number;
    time_preference: number;
  };
  num_results: number;
  solver: string;
}
