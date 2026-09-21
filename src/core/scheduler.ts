import { Schedule, ScheduleDay, Question, Requirement } from './types.js';

export class DeterministicScheduler {
  /**
   * Distributes questions across exactly `daysAvailable` days according to arithmetic rules:
   * 1. Days count must equal daysAvailable.
   * 2. Must-have requirements prioritized.
   * 3. Harder (higher difficulty) and system design/architecture material placed in earlier days.
   * 4. Minutes are exact positive integers (e.g. 30-90 min/day depending on load).
   * 5. Every question_id in schedule refers to an existing question.
   */
  generateSchedule(
    daysAvailable: number,
    questions: Question[],
    requirements: Requirement[]
  ): Schedule {
    const daysCount = Math.max(1, Math.floor(daysAvailable));

    if (questions.length === 0) {
      // Degenerate case fallback
      const emptyDays: ScheduleDay[] = Array.from({ length: daysCount }, (_, i) => ({
        day: i + 1,
        focus: i === 0 ? 'General Preparation & Alignment' : 'Review & Practice',
        question_ids: [],
        minutes: 30,
      }));
      return {
        days_available: daysCount,
        days: emptyDays,
      };
    }

    // Build requirement priority map
    const reqPriorityMap = new Map<string, { priority: string; kind: string }>();
    for (const req of requirements) {
      reqPriorityMap.set(req.id, { priority: req.priority, kind: req.kind });
    }

    // Calculate weight/priority score for each question
    // Score = (difficulty * 10) + (must-have bonus 20) + (system-design / core technical bonus 10)
    const scoredQuestions = questions.map((q) => {
      let score = q.difficulty * 10;
      let hasMust = false;

      for (const reqId of q.requirement_ids) {
        const meta = reqPriorityMap.get(reqId);
        if (meta?.priority === 'must') {
          hasMust = true;
          break;
        }
      }

      if (hasMust) score += 25;
      if (q.category === 'system-design') score += 15;
      if (q.category === 'technical') score += 10;
      if (q.category === 'behavioural') score += 5;

      return { question: q, score };
    });

    // Sort questions descending by score so high-priority & hard items land first
    scoredQuestions.sort((a, b) => b.score - a.score);

    // Grouping / distribution into daysCount buckets
    const dayBuckets: { questionIds: string[]; totalMinutes: number; categories: Set<string> }[] = Array.from(
      { length: daysCount },
      () => ({
        questionIds: [],
        totalMinutes: 0,
        categories: new Set<string>(),
      })
    );

    // If daysCount >= questions.length, spread questions across the earliest days, leaving later days for mock/review
    if (daysCount >= questions.length) {
      // Allocate roughly 1 question per day for the first N days
      scoredQuestions.forEach((item, index) => {
        const bucketIndex = Math.min(index, daysCount - 1);
        const mins = this.estimateQuestionMinutes(item.question);
        dayBuckets[bucketIndex].questionIds.push(item.question.id);
        dayBuckets[bucketIndex].totalMinutes += mins;
        dayBuckets[bucketIndex].categories.add(item.question.category);
      });
    } else {
      // Arithmetic round-robin / chunk allocation
      scoredQuestions.forEach((item, index) => {
        // Distribute proportionally across days
        const bucketIndex = Math.floor((index / scoredQuestions.length) * daysCount);
        const mins = this.estimateQuestionMinutes(item.question);
        dayBuckets[bucketIndex].questionIds.push(item.question.id);
        dayBuckets[bucketIndex].totalMinutes += mins;
        dayBuckets[bucketIndex].categories.add(item.question.category);
      });
    }

    // Build the final ScheduleDay array with descriptive focus titles and integer minutes
    const scheduleDays: ScheduleDay[] = dayBuckets.map((bucket, index) => {
      const dayNum = index + 1;
      let focus = '';

      if (bucket.questionIds.length === 0) {
        if (dayNum === daysCount) {
          focus = 'Final Mock Interview & Confidence Check';
        } else if (dayNum === daysCount - 1) {
          focus = 'Comprehensive Review & Spaced Flashcards';
        } else {
          focus = `Spaced Repetition & Deep Dive Reinforcement (Day ${dayNum})`;
        }
      } else {
        const catList = Array.from(bucket.categories);
        if (catList.includes('system-design') && catList.includes('technical')) {
          focus = 'Architecture & Core Technical Deep-Dive';
        } else if (catList.includes('technical')) {
          focus = 'Technical Fundamentals & Code Scenarios';
        } else if (catList.includes('behavioural')) {
          focus = 'Behavioural Scenarios & STAR Leadership Alignment';
        } else if (catList.includes('company-fit')) {
          focus = 'Company Alignment & Culture Values';
        } else {
          focus = `Targeted Mastery: ${catList.join(' & ')}`;
        }
      }

      // Minimum integer duration calculation (integer minutes, no float)
      let minutes = Math.max(30, bucket.totalMinutes);
      // Cap individual daily duration to realistic study sessions
      if (minutes > 180) minutes = 180;

      return {
        day: dayNum,
        focus,
        question_ids: bucket.questionIds,
        minutes,
      };
    });

    return {
      days_available: daysCount,
      days: scheduleDays,
    };
  }

  private estimateQuestionMinutes(q: Question): number {
    if (q.category === 'system-design') return 30;
    if (q.category === 'technical') return q.difficulty === 3 ? 25 : 15;
    if (q.category === 'behavioural') return 15;
    return 10;
  }
}
