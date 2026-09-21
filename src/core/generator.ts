import { CompanyBrief, Question, Flashcard, Role, ResearchSummary } from './types.js';
import { LLMClient, defaultLLM } from './llm.js';

export class KitGenerator {
  constructor(private llm: LLMClient = defaultLLM) {}

  async generateCompanyBrief(companyUrl: string, research: ResearchSummary, roleTitle: string): Promise<CompanyBrief> {
    const validPages = research.pagesCrawled.filter((p) => !p.error && p.cleanedText.length > 50);

    // If company site had 404/no info, report honestly without fabricating
    if (validPages.length === 0) {
      return {
        summary: `No public company information could be retrieved from ${companyUrl || 'the provided address'}. Gaps are recorded honestly.`,
        what_they_do: 'Unable to retrieve company product/service details from the provided URL.',
        sources: research.sources.length > 0 ? research.sources : (companyUrl ? [companyUrl] : []),
      };
    }

    if (!this.llm.hasApiKey()) {
      const firstPage = validPages[0];
      return {
        summary: `${research.companyName || 'The company'} operates online at ${companyUrl}. Information gathered from homepage and public links.`,
        what_they_do: firstPage.cleanedText.slice(0, 300) + '...',
        sources: research.sources,
      };
    }

    const pagesContext = validPages
      .map((p) => `URL: ${p.url}\nTitle: ${p.title}\nContent:\n${p.cleanedText.slice(0, 3000)}`)
      .join('\n\n---\n\n');

    const prompt = `You are an interview preparation researcher.
Summarize this company based STRICTLY on the crawled website content below for a candidate interviewing for "${roleTitle}".
DO NOT FABRICATE facts. If the company site does not disclose details, state that honestly.

Return JSON in this exact shape:
{
  "summary": "2-3 concise paragraphs summarizing the company, their mission, culture, and any hiring/interview details discovered.",
  "what_they_do": "Clear 1-2 sentence description of their core product/services and industry domain.",
  "sources": ${JSON.stringify(research.sources)}
}

CRAWLED PAGES:
${pagesContext}`;

    try {
      const brief = await this.llm.generateJson<CompanyBrief>(prompt, { temperature: 0.2 });
      return {
        summary: brief.summary || 'Company overview gathered from website.',
        what_they_do: brief.what_they_do || 'Technology company.',
        sources: research.sources.length > 0 ? research.sources : brief.sources || [],
      };
    } catch (err) {
      console.warn('Brief generation error:', err);
      return {
        summary: `Overview for ${research.companyName} based on retrieved web resources.`,
        what_they_do: validPages[0]?.cleanedText.slice(0, 250) || 'Company information retrieved.',
        sources: research.sources,
      };
    }
  }

  // Generate category-specific questions in deliberate, dedicated sequences
  async generateQuestionsForCategory(
    category: 'technical' | 'behavioural' | 'system-design' | 'company-fit',
    role: Role,
    companyBrief: CompanyBrief,
    existingQuestionCount: number = 0
  ): Promise<Question[]> {
    // Filter relevant requirements
    const relevantReqs = role.requirements.filter((r) => {
      if (category === 'technical') return r.kind === 'technical';
      if (category === 'behavioural') return r.kind === 'behavioural';
      if (category === 'system-design') return r.kind === 'technical' || r.kind === 'domain';
      if (category === 'company-fit') return r.kind === 'behavioural' || r.kind === 'domain';
      return true;
    });

    const targetReqs = relevantReqs.length > 0 ? relevantReqs : role.requirements;

    if (!this.llm.hasApiKey()) {
      return this.heuristicQuestionsForCategory(category, targetReqs, existingQuestionCount);
    }

    const prompt = `You are a specialist interviewer conducting the "${category.toUpperCase()}" round for "${role.title}" (${role.seniority}).
Target Requirements to test:
${targetReqs.map((r) => `- [${r.id}] (${r.priority}): ${r.text}`).join('\n')}

Company Context:
"${companyBrief.what_they_do}"

Generate 2 to 4 high-yield, realistic interview questions for this category.
CRITICAL RULES:
1. Every question MUST explicitly reference one or more requirement IDs it tests in "requirement_ids".
2. "category" must be "${category}".
3. "difficulty" must be an integer from 1 (fundamental) to 3 (complex/senior).
4. "answer_outline" must contain key points a strong candidate should hit (e.g. STAR method for behavioural, trade-offs/architecture for system design, edge cases/complexity for technical).

Output JSON array:
[
  {
    "requirement_ids": ["r1"],
    "category": "${category}",
    "prompt": "Question prompt",
    "answer_outline": "Key points to cover...",
    "difficulty": 2
  }
]`;

    try {
      const rawList = await this.llm.generateJson<Omit<Question, 'id'>[]>(prompt, { temperature: 0.3 });
      let qIndex = existingQuestionCount + 1;
      return rawList.map((q) => ({
        id: `q${qIndex++}`,
        requirement_ids: Array.isArray(q.requirement_ids) && q.requirement_ids.length > 0 ? q.requirement_ids : [targetReqs[0]?.id || 'r1'],
        category,
        prompt: q.prompt || `Explain your experience regarding ${targetReqs[0]?.text || 'this role'}.`,
        answer_outline: q.answer_outline || 'Provide concrete examples and trade-offs.',
        difficulty: typeof q.difficulty === 'number' && q.difficulty >= 1 && q.difficulty <= 3 ? Math.round(q.difficulty) : 2,
      }));
    } catch (err) {
      console.warn(`Question generation failed for ${category}:`, err);
      return this.heuristicQuestionsForCategory(category, targetReqs, existingQuestionCount);
    }
  }

  private heuristicQuestionsForCategory(
    category: 'technical' | 'behavioural' | 'system-design' | 'company-fit',
    reqs: Role['requirements'],
    existingCount: number
  ): Question[] {
    const questions: Question[] = [];
    let qIdx = existingCount + 1;

    for (const req of reqs.slice(0, 3)) {
      let prompt = '';
      let outline = '';
      let diff = req.priority === 'must' ? 2 : 1;

      if (category === 'technical') {
        prompt = `How would you apply your deep expertise in ${req.text} to solve performance bottlenecks in a high-throughput production service?`;
        outline = `1. Explain core mechanisms. 2. Identify common failure modes and profiling techniques. 3. Describe concrete optimization metrics.`;
      } else if (category === 'behavioural') {
        prompt = `Tell me about a challenging situation where you had to demonstrate ${req.text}. What was the outcome?`;
        outline = `Use STAR: Situation context, Task objective, Action taken with team communication, and measurable Result.`;
      } else if (category === 'system-design') {
        prompt = `Design an end-to-end scalable architecture that incorporates ${req.text}, highlighting data flow and fault tolerance.`;
        outline = `1. Requirements & scale estimations. 2. High-level component diagram. 3. Data storage & caching. 4. Bottlenecks & failover.`;
        diff = 3;
      } else {
        prompt = `Why are you excited to contribute to our mission, and how does your background with ${req.text} align with our engineering culture?`;
        outline = `Show alignment with product values, collaborative work style, and long-term impact.`;
      }

      questions.push({
        id: `q${qIdx++}`,
        requirement_ids: [req.id],
        category,
        prompt,
        answer_outline: outline,
        difficulty: diff,
      });
    }

    return questions;
  }

  // Generate flashcards for quick revision / practice mode
  async generateFlashcards(role: Role, questions: Question[]): Promise<Flashcard[]> {
    if (!this.llm.hasApiKey()) {
      return role.requirements.map((req, idx) => ({
        id: `f${idx + 1}`,
        front: `Key Concept: ${req.text.slice(0, 80)}`,
        back: `Core understanding of ${req.text}. Focus on practical trade-offs, architecture patterns, and operational debugging.`,
        requirement_ids: [req.id],
      }));
    }

    const prompt = `You are creating high-yield interview revision flashcards.
Role: ${role.title}
Requirements:
${role.requirements.map((r) => `- [${r.id}]: ${r.text}`).join('\n')}

Generate 5 to 10 bite-sized flashcards focusing on core concepts, tricky interview gotchas, and architectural definitions.
Every flashcard must have:
- "front": A sharp concept, question, or scenario prompt
- "back": Concise, high-density key answer / bullet points
- "requirement_ids": Array of requirement IDs it covers (e.g. ["r1"])

Output JSON array:
[
  {
    "front": "What is the difference between X and Y in production?",
    "back": "X does ... whereas Y does ...",
    "requirement_ids": ["r1"]
  }
]`;

    try {
      const rawCards = await this.llm.generateJson<Omit<Flashcard, 'id'>[]>(prompt, { temperature: 0.3 });
      let fIndex = 1;
      return rawCards.map((c) => ({
        id: `f${fIndex++}`,
        front: c.front,
        back: c.back,
        requirement_ids: Array.isArray(c.requirement_ids) && c.requirement_ids.length > 0 ? c.requirement_ids : [role.requirements[0]?.id || 'r1'],
      }));
    } catch (err) {
      console.warn('Flashcard generation failed:', err);
      return role.requirements.map((req, idx) => ({
        id: `f${idx + 1}`,
        front: `Review: ${req.text}`,
        back: `Crucial knowledge points for ${req.text}`,
        requirement_ids: [req.id],
      }));
    }
  }
}
