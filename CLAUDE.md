# CLAUDE.md - AI Development Directives & Context

## Project Summary
Autonomous AI Interview Preparation Platform (`PrepMatrix AI`). Given a job description and company URL, the engine crawls public company intelligence, extracts role requirements, enforces deterministic two-pass question coverage, and constructs an arithmetic day-by-day study schedule with interactive flashcards, live inline kit editing, and an AI mock interview studio.

## Commands
- `npm run dev`: Start both Express API server and Next.js client concurrently
- `npm run dev:server`: Start Express API server only with `tsx watch`
- `npm run dev:client`: Start Next.js client only on port 3000
- `npm run build`: Build TypeScript backend (`tsconfig.server.json`) and Next.js client
- `npm run test`: Run the Vitest automated test suite (`tests/pipeline.test.ts`)
- `npm run evaluate -- --input <cases.json> --output <kits.json>`: Execute Section 9 batch evaluation CLI

## Architecture Guidelines
- All LLM prompt engineering must use structured JSON schema parsing with fallback recovery.
- Never write credentials into source control. Rely on `.env` and `.env.example`.
- Ensure crawler incorporates SSRF protections (blocking loopback/private IPs in production) and respects `robots.txt`.
