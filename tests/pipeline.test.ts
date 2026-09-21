import { describe, it, expect } from 'vitest';
import { DeterministicScheduler } from '../src/core/scheduler.js';
import { CoverageEngine } from '../src/core/coverage.js';
import { scoreLink, isSafeUrl } from '../src/core/crawler.js';
import { KitSchema, Requirement, Question } from '../src/core/types.js';
import { InterviewPrepPipeline } from '../src/core/pipeline.js';

describe('DeterministicScheduler', () => {
  const scheduler = new DeterministicScheduler();

  const mockRequirements: Requirement[] = [
    { id: 'r1', text: '5+ years React', kind: 'technical', priority: 'must' },
    { id: 'r2', text: 'Distributed system design', kind: 'technical', priority: 'must' },
    { id: 'r3', text: 'Team mentorship', kind: 'behavioural', priority: 'nice' },
  ];

  const mockQuestions: Question[] = [
    { id: 'q1', requirement_ids: ['r1'], category: 'technical', prompt: 'React lifecycle', answer_outline: '...', difficulty: 2 },
    { id: 'q2', requirement_ids: ['r2'], category: 'system-design', prompt: 'Design distributed cache', answer_outline: '...', difficulty: 3 },
    { id: 'q3', requirement_ids: ['r3'], category: 'behavioural', prompt: 'Mentoring experience', answer_outline: '...', difficulty: 1 },
  ];

  it('generates a schedule spanning exactly the requested number of days', () => {
    const daysRequested = 5;
    const schedule = scheduler.generateSchedule(daysRequested, mockQuestions, mockRequirements);

    expect(schedule.days_available).toBe(5);
    expect(schedule.days).toHaveLength(5);
    schedule.days.forEach((day, idx) => {
      expect(day.day).toBe(idx + 1);
      expect(Number.isInteger(day.minutes)).toBe(true);
      expect(day.minutes).toBeGreaterThanOrEqual(30);
      expect(typeof day.focus).toBe('string');
      expect(Array.isArray(day.question_ids)).toBe(true);
    });
  });

  it('places harder / must-have questions in earlier days', () => {
    const schedule = scheduler.generateSchedule(3, mockQuestions, mockRequirements);
    // q2 (system design, diff 3, must) should be in day 1
    expect(schedule.days[0].question_ids).toContain('q2');
  });

  it('handles 1-day rush schedule', () => {
    const schedule = scheduler.generateSchedule(1, mockQuestions, mockRequirements);
    expect(schedule.days).toHaveLength(1);
    expect(schedule.days[0].question_ids.length).toBeGreaterThanOrEqual(1);
  });
});

describe('CoverageEngine', () => {
  const engine = new CoverageEngine();

  it('accurately identifies covered and uncovered must-have requirements', () => {
    const reqs: Requirement[] = [
      { id: 'r1', text: 'Node.js', kind: 'technical', priority: 'must' },
      { id: 'r2', text: 'Docker', kind: 'technical', priority: 'must' },
      { id: 'r3', text: 'GraphQL', kind: 'technical', priority: 'nice' },
    ];

    const questions: Question[] = [
      { id: 'q1', requirement_ids: ['r1'], category: 'technical', prompt: 'Node stream', answer_outline: '...', difficulty: 2 },
    ];

    const analysis = engine.analyzeCoverage(reqs, questions);

    expect(analysis.coveredRequirementIds.has('r1')).toBe(true);
    expect(analysis.uncoveredMustRequirementIds).toEqual(['r2']);
    expect(analysis.uncoveredRequirementIds).toContain('r2');
    expect(analysis.uncoveredRequirementIds).toContain('r3');
  });
});

describe('CompanyCrawler Link Scoring & Security', () => {
  it('prioritizes hiring and career paths', () => {
    const base = 'https://example.com';
    const careerScore = scoreLink('https://example.com/careers', base);
    const handbookScore = scoreLink('https://example.com/handbook/hiring', base);
    const privacyScore = scoreLink('https://example.com/privacy-policy', base);

    expect(careerScore).toBeGreaterThan(privacyScore);
    expect(handbookScore).toBeGreaterThan(privacyScore);
  });

  it('validates URLs safely', () => {
    expect(isSafeUrl('https://example.com').safe).toBe(true);
    expect(isSafeUrl('javascript:alert(1)').safe).toBe(false);
  });
});

describe('Full Pipeline Conformance with Appendix A', () => {
  it('generates a valid Appendix A kit', async () => {
    const pipeline = new InterviewPrepPipeline({ maxCoveragePasses: 2 });
    const kit = await pipeline.generateKit({
      jd: `Senior Full Stack Engineer
Responsibilities:
- Build high-scale microservices and web interfaces
Requirements:
- 5+ years of experience with TypeScript and Node.js (must have)
- Strong experience with PostgreSQL database optimization
- Bonus: Experience with Kubernetes and Docker`,
      company_url: 'https://example.com',
      days: 4,
    });

    const validation = KitSchema.safeParse(kit);
    expect(validation.success).toBe(true);
    if (!validation.success) {
      console.error(validation.error);
    }

    expect(kit.schedule.days_available).toBe(4);
    expect(kit.schedule.days).toHaveLength(4);
    expect(kit.role.requirements.length).toBeGreaterThanOrEqual(2);
    expect(kit.coverage.passes).toBeGreaterThanOrEqual(1);
  });
});
