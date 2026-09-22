# AI-Assisted Prompt Sequence & Workflow Log

This document records the sequence of prompt directives, subagent workflows, and design decisions used during the end-to-end development of the **AI Interview Preparation Platform** (`PrepMatrix AI`).

---

## Prompt Sequence & Milestones

### 1. Requirements Ingestion & Schema Specification
- **Directive**: Analyze the full assessment specification, Appendix A schema requirements (`source`, `company_brief`, `role`, `questions`, `flashcards`, `schedule`, `coverage`), Appendix B batch evaluation format, and Section 6/7/14 feature guidelines.
- **Outcome**: Created strict TypeScript interfaces in `src/core/types.ts` and runtime Zod validation schemas.

---

### 2. SSRF-Safe Crawler & Heuristic Link Scorer
- **Directive**: Implement an autonomous web crawler in `src/core/crawler.ts` that enforces SSRF safety checks (blocking private IPs in production), parses `robots.txt`, prioritizes high-value career/about pages, and degrades gracefully on 404/500 external domain errors.
- **Outcome**: Resilient scraping module capable of extracting clean page content while respecting bot etiquette.

---

### 3. Deterministic Two-Pass Generation Engine
- **Directive**: Design a two-pass LLM pipeline in `src/core/generator.ts`:
  - **Pass 1**: Extract structured must-have and nice-to-have requirements, generate company brief, and build categorized question banks.
  - **Pass 2**: Audit must-have requirement question coverage deterministically. Synthesize supplementary questions if gaps are detected to guarantee 100% coverage.
- **Outcome**: Fully deterministic, schema-compliant interview prep kits with stable `rX` and `qY` IDs.

---

### 4. Arithmetic Study Schedule & Spaced Repetition Engine
- **Directive**: Implement difficulty-weighted scheduling in `src/core/scheduler.ts` ensuring:
  - Higher-difficulty and mandatory questions are scheduled earlier in the calendar.
  - Study durations strictly adhere to realistic integer minutes per day.
- **Outcome**: Dynamic schedule generator dividing preparation across $N$ days evenly and intelligently.

---

### 5. Full-Stack API, Auth & SSE Streaming
- **Directive**: Build the Node.js Express server in `server/` with JWT authentication, bcrypt password hashing, SSE progress updates, and a hybrid database adapter supporting MongoDB with zero-config local `.data/` JSON fallback.
- **Outcome**: High-performance backend API serving all frontend interactions.

---

### 6. Interactive Next.js Frontend, Mock Studio & 1-Pager Export
- **Directive**: Develop modern Next.js 14 App Router client with dark-mode aesthetic, live progress bars, 3D interactive flashcards with confidence ratings, inline kit editing, and an AI Mock Studio with STAR rubric feedback.
- **Outcome**: Polished, responsive user interface.

---

### 7. Section 9 CLI Batch Evaluation Harness & Vitest Suite
- **Directive**: Build `batch/evaluate.ts` to process arbitrary `--input <cases.json>` and write valid `--output <kits.json>`, and create unit/integration tests in `tests/pipeline.test.ts`.
- **Outcome**: 100% passing tests and valid sample evaluation datasets.
