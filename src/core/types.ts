import { z } from 'zod';

// Appendix A exact schema definitions

export const RequirementKindSchema = z.enum(['technical', 'behavioural', 'domain']);
export type RequirementKind = z.infer<typeof RequirementKindSchema>;

export const RequirementPrioritySchema = z.enum(['must', 'nice']);
export type RequirementPriority = z.infer<typeof RequirementPrioritySchema>;

export const RequirementSchema = z.object({
  id: z.string(),
  text: z.string(),
  kind: RequirementKindSchema,
  priority: RequirementPrioritySchema,
});
export type Requirement = z.infer<typeof RequirementSchema>;

export const QuestionCategorySchema = z.enum(['technical', 'behavioural', 'system-design', 'company-fit']);
export type QuestionCategory = z.infer<typeof QuestionCategorySchema>;

export const QuestionSchema = z.object({
  id: z.string(),
  requirement_ids: z.array(z.string()),
  category: QuestionCategorySchema,
  prompt: z.string(),
  answer_outline: z.string(),
  difficulty: z.number().int().min(1).max(3),
  // Builder state extension fields (optional, preserved during regeneration)
  is_pinned: z.boolean().optional(),
  is_edited: z.boolean().optional(),
  is_custom: z.boolean().optional(),
});
export type Question = z.infer<typeof QuestionSchema>;

export const FlashcardSchema = z.object({
  id: z.string(),
  front: z.string(),
  back: z.string(),
  requirement_ids: z.array(z.string()),
  // Practice state extensions
  confidence: z.number().optional(), // 1 to 5
  last_reviewed: z.string().optional(),
  repetitions: z.number().optional(),
  interval: z.number().optional(),
  ease_factor: z.number().optional(),
  is_custom: z.boolean().optional(),
});
export type Flashcard = z.infer<typeof FlashcardSchema>;

export const ScheduleDaySchema = z.object({
  day: z.number().int().positive(),
  focus: z.string(),
  question_ids: z.array(z.string()),
  minutes: z.number().int().nonnegative(),
});
export type ScheduleDay = z.infer<typeof ScheduleDaySchema>;

export const ScheduleSchema = z.object({
  days_available: z.number().int().positive(),
  days: z.array(ScheduleDaySchema),
});
export type Schedule = z.infer<typeof ScheduleSchema>;

export const CoverageSchema = z.object({
  uncovered_requirement_ids: z.array(z.string()),
  passes: z.number().int().nonnegative(),
});
export type Coverage = z.infer<typeof CoverageSchema>;

export const SourceSchema = z.object({
  company: z.string(),
  company_url: z.string(),
  role: z.string(),
  location: z.string(),
  jd_chars: z.number().int().nonnegative(),
  researched_at: z.string(),
  pages_used: z.array(z.string()),
});
export type Source = z.infer<typeof SourceSchema>;

export const CompanyBriefSchema = z.object({
  summary: z.string(),
  what_they_do: z.string(),
  sources: z.array(z.string()),
  culture_notes: z.string().optional(),
  interview_process_notes: z.string().optional(),
});
export type CompanyBrief = z.infer<typeof CompanyBriefSchema>;

export const RoleSchema = z.object({
  title: z.string(),
  seniority: z.string(),
  responsibilities: z.array(z.string()),
  requirements: z.array(RequirementSchema),
});
export type Role = z.infer<typeof RoleSchema>;

export const KitSchema = z.object({
  source: SourceSchema,
  company_brief: CompanyBriefSchema,
  role: RoleSchema,
  questions: z.array(QuestionSchema),
  flashcards: z.array(FlashcardSchema),
  schedule: ScheduleSchema,
  coverage: CoverageSchema,
});
export type Kit = z.infer<typeof KitSchema>;

// Batch Entry / Exit schemas (Appendix B)
export const BatchCaseSchema = z.object({
  id: z.string(),
  jd: z.string(),
  company_url: z.string(),
  days: z.number().int().positive(),
});
export type BatchCase = z.infer<typeof BatchCaseSchema>;

export const BatchOutputErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
});
export type BatchOutputError = z.infer<typeof BatchOutputErrorSchema>;

export const BatchKitResultSchema = z.object({
  id: z.string(),
  status: z.enum(['ok', 'failed']),
  kit: KitSchema.nullable(),
  error: BatchOutputErrorSchema.nullable(),
});
export type BatchKitResult = z.infer<typeof BatchKitResultSchema>;

export const BatchOutputFileSchema = z.object({
  version: z.string(),
  generated_at: z.string(),
  kits: z.array(BatchKitResultSchema),
});
export type BatchOutputFile = z.infer<typeof BatchOutputFileSchema>;

export interface CrawlResult {
  url: string;
  statusCode?: number;
  title?: string;
  cleanedText: string;
  discoveredLinks: string[];
  isHiringPage?: boolean;
  error?: string;
}

export interface ResearchSummary {
  companyName: string;
  companyUrl: string;
  pagesCrawled: CrawlResult[];
  publicDiscussionSnippets: string[];
  sources: string[];
}

export type GenerationProgressCallback = (step: {
  phase: 'crawling' | 'extraction' | 'generation_pass_1' | 'coverage_check' | 'generation_pass_2' | 'scheduling' | 'complete' | 'error';
  message: string;
  progressPercent: number;
  data?: any;
}) => void;
