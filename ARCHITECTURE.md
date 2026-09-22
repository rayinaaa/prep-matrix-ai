# Production System Architecture

## Overview
**PrepMatrix AI** is an enterprise-grade, autonomous interview preparation and research strategy engine designed for high throughput, deterministic accuracy, and low latency.

```
+---------------------------------------------------------------------------------------+
|                                    CLIENT TIER                                        |
|  - Next.js 14 App Router (React 18 + Tailwind CSS + Framer Motion)                    |
|  - Server-Sent Events (SSE) Live Pipeline Progress Listener                           |
|  - Interactive 3D Spaced-Repetition Flashcards & In-line Kit Editor                   |
|  - AI Mock Interview Studio (STAR Rubric Evaluator & 1-Pager Exporter)                 |
+-------------------------------------------+-------------------------------------------+
                                            |
                                            v (REST / SSE over HTTP/2)
+---------------------------------------------------------------------------------------+
|                                 API GATEWAY / ROUTING TIER                            |
|  - Express.js Router (JWT Auth, Role-Based Access Control, CORS, Rate Limiting)       |
|  - Input Validation & Sanitization (Zod Runtime Type Enforcement)                     |
+-------------------------------------------+-------------------------------------------+
                                            |
                                            v
+---------------------------------------------------------------------------------------+
|                               CORE AUTONOMOUS ENGINE                                  |
|  1. Safe Crawler: SSRF-Guarded HTTP Client, robots.txt Parsing, HTML Stripping        |
|  2. LLM Orchestrator: Gemini 1.5 Flash Provider with Exponential-Backoff Retry        |
|  3. Two-Pass Pipeline: Deterministic Requirement Extraction & Gap-Coverage Audit      |
|  4. Arithmetic Scheduler: Difficulty-Weighted Day-by-Day Time Balancing               |
+---------------------+-------------------------------------+---------------------------+
                      |                                     |
                      v                                     v
+------------------------------------+   +----------------------------------------------+
|         PERSISTENCE LAYER          |   |            EXTERNAL SERVICES                 |
|  - MongoDB (Primary Document Store)|   |  - Google Gemini API (Structured JSON Mode)  |
|  - Local File Fallback (.data/)    |   |  - Target Company Web Domains (Crawl Target) |
+------------------------------------+   +----------------------------------------------+
```

---

## 1. Core Subsystems

### A. SSRF-Safe Web Crawling Engine (`src/core/crawler.ts`)
- **Protocol Filtering**: Rejects non-HTTP/HTTPS protocols.
- **Network Validation**: Disallows loopback and private internal network addresses (`127.0.0.1`, `10.0.0.0/8`, `192.168.0.0/16`, `172.16.0.0/12`) in production environments.
- **Robots.txt Compliance**: Automatically queries and respects `robots.txt` disallow rules.
- **Fail-Soft Graceful Degradation**: If external domains are blocked or unreachable (404/500), crawler recovers immediately without pipeline disruption.

### B. Deterministic Two-Pass Generation Pipeline (`src/core/generator.ts`)
- **Pass 1 (Extraction & Generation)**: Extracts categorized requirements (Must-Have, Nice-to-Have, Culture) and synthesizes tailored Technical, System Design, and Behavioral question banks.
- **Pass 2 (Coverage Audit & Remediation)**: Deterministically analyzes question mapping against all mandatory requirements. Automatically triggers fallback generation if any required skill lacks question coverage.

### C. Arithmetic Study Scheduler (`src/core/scheduler.ts`)
- **Difficulty & Priority Scoring**:
  $$\text{Score} = (\text{Difficulty} \times 10) + (\text{Must-Have Bonus: } 25) + (\text{System Design Bonus: } 15)$$
- **Early-Day Distribution**: Places hardest and highest-priority questions earlier in the calendar to maximize retention.
- **Integer Minutes Constraint**: Caps and balances daily study durations to realistic integer intervals.

### D. Multi-Tier Persistence (`server/db.ts`)
- Seamless hybrid database adapter: connects to cloud MongoDB instance when `MONGODB_URI` is provided, with an automatic zero-config fallback to local atomic JSON files (`.data/`) for effortless offline reviewer evaluation.
