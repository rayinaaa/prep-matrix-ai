# AGENTS.md - Multi-Agent & AI Workflow Guidelines

This document defines the agent architecture, operational boundaries, and development conventions for the **AI Interview Preparation Platform** (`PrepMatrix AI`).

---

## 🤖 Agent Roles & Capabilities

### 1. `prep-core-architect` (Pipeline & Schema Subagent)
- **Specialization**: Deterministic two-pass interview generation pipeline, strict schema validation (Zod & TypeScript), and SSRF-safe web scraping.
- **Rules**:
  - Always enforce exact Appendix A/B schema compliance (`source`, `company_brief`, `role`, `questions`, `flashcards`, `schedule`, `coverage`).
  - Maintain stable ID generation (`r1..rN`, `q1..qM`).
  - Ensure zero placeholder responses; handle network 404s/timeouts gracefully with deterministic fallback intelligence.

### 2. `ui-studio-engineer` (Interactive Client Subagent)
- **Specialization**: Next.js 14 App Router, responsive dark-mode aesthetics, interactive 3D flashcards, inline kit editing, and AI mock interview studio.
- **Rules**:
  - Implement fluid real-time updates and Server-Sent Events (SSE) streaming progress.
  - Maintain WCAG accessibility and responsive desktop/mobile layouts.
  - Ensure instant offline 1-pager printable kit exports.

### 3. `systems-evaluator-agent` (CLI Batch & Benchmark Subagent)
- **Specialization**: Section 9 automated evaluation harness (`npm run evaluate`), test suites (`vitest`), and performance benchmarking.
- **Rules**:
  - Ensure all batch evaluations process arrays of input cases and write formatted JSON without throwing unhandled rejections.

---

## 🛠️ Tech Stack & Conventions
- **Frontend**: Next.js 14 (App Router), Tailwind CSS, Framer Motion, Lucide React
- **Backend API**: Node.js, Express, TypeScript, Server-Sent Events (SSE)
- **Persistence**: MongoDB with zero-config local `.data/` JSON fallback
- **AI Engine**: Google Gemini 1.5 Flash (via `@google/generative-ai`) with exponential backoff
- **Testing & Verification**: Vitest suite with 100% Appendix A schema conformance tests
