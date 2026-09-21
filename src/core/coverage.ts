import { Requirement, Question, Coverage } from './types.js';
import { LLMClient, defaultLLM } from './llm.js';

export interface CoverageAnalysis {
  coveredRequirementIds: Set<string>;
  uncoveredRequirementIds: string[];
  uncoveredMustRequirementIds: string[];
  coverageRatio: number;
}

export class CoverageEngine {
  constructor(private llm: LLMClient = defaultLLM) {}

  // Deterministic calculation of uncovered requirement IDs
  analyzeCoverage(requirements: Requirement[], questions: Question[]): CoverageAnalysis {
    const coveredSet = new Set<string>();

    for (const q of questions) {
      if (Array.isArray(q.requirement_ids)) {
        for (const reqId of q.requirement_ids) {
          if (reqId) coveredSet.add(reqId);
        }
      }
    }

    const uncoveredAll: string[] = [];
    const uncoveredMust: string[] = [];

    for (const req of requirements) {
      if (!coveredSet.has(req.id)) {
        uncoveredAll.push(req.id);
        if (req.priority === 'must') {
          uncoveredMust.push(req.id);
        }
      }
    }

    const totalReqs = requirements.length;
    const ratio = totalReqs > 0 ? (totalReqs - uncoveredAll.length) / totalReqs : 1;

    return {
      coveredRequirementIds: coveredSet,
      uncoveredRequirementIds: uncoveredAll,
      uncoveredMustRequirementIds: uncoveredMust,
      coverageRatio: ratio,
    };
  }

  // Targeted question generation for uncovered requirements during Pass 2+
  async generateGapQuestions(
    uncoveredReqs: Requirement[],
    roleTitle: string,
    existingQuestionCount: number
  ): Promise<Question[]> {
    if (uncoveredReqs.length === 0) return [];

    let qIdx = existingQuestionCount + 1;

    if (!this.llm.hasApiKey()) {
      return uncoveredReqs.map((req) => ({
        id: `q${qIdx++}`,
        requirement_ids: [req.id],
        category: req.kind === 'behavioural' ? 'behavioural' : 'technical',
        prompt: `Deep dive: How do you address the specific requirement for "${req.text}" in production?`,
        answer_outline: `Provide architectural depth and operational examples regarding ${req.text}.`,
        difficulty: req.priority === 'must' ? 2 : 1,
      }));
    }

    const prompt = `You are an interview auditor closing coverage gaps for "${roleTitle}".
The following critical requirements have NO interview questions assigned yet:
${uncoveredReqs.map((r) => `- [${r.id}] (${r.kind}, ${r.priority}): ${r.text}`).join('\n')}

Generate exactly one targeted question for EACH uncovered requirement.
CRITICAL:
1. "requirement_ids" must contain the corresponding requirement ID (e.g. ["${uncoveredReqs[0].id}"]).
2. "category": choose appropriate "technical" | "behavioural" | "system-design" | "company-fit".
3. "difficulty": 1 to 3 integer.
4. "answer_outline": comprehensive points covering the requirement.

Output JSON array:
[
  {
    "requirement_ids": ["${uncoveredReqs[0].id}"],
    "category": "technical",
    "prompt": "Specific question testing this requirement",
    "answer_outline": "Key points to cover...",
    "difficulty": 2
  }
]`;

    try {
      const generated = await this.llm.generateJson<Omit<Question, 'id'>[]>(prompt, { temperature: 0.2 });
      return generated.map((q, i) => ({
        id: `q${qIdx++}`,
        requirement_ids: Array.isArray(q.requirement_ids) && q.requirement_ids.length > 0 ? q.requirement_ids : [uncoveredReqs[i]?.id || uncoveredReqs[0].id],
        category: ['technical', 'behavioural', 'system-design', 'company-fit'].includes(q.category) ? q.category : 'technical',
        prompt: q.prompt || `Explain your experience with ${uncoveredReqs[i]?.text || 'this requirement'}.`,
        answer_outline: q.answer_outline || 'Detailed explanation with trade-offs.',
        difficulty: typeof q.difficulty === 'number' && q.difficulty >= 1 && q.difficulty <= 3 ? Math.round(q.difficulty) : 2,
      }));
    } catch (err) {
      console.warn('Gap question generation fallback:', err);
      return uncoveredReqs.map((req) => ({
        id: `q${qIdx++}`,
        requirement_ids: [req.id],
        category: req.kind === 'behavioural' ? 'behavioural' : 'technical',
        prompt: `Can you walk me through your experience with ${req.text}?`,
        answer_outline: `Explain principles, practical applications, and edge cases for ${req.text}.`,
        difficulty: 2,
      }));
    }
  }
}
