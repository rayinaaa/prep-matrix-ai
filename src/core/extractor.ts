import { Role, Requirement } from './types.js';
import { LLMClient, defaultLLM } from './llm.js';

export class RoleExtractor {
  constructor(private llm: LLMClient = defaultLLM) {}

  // Deterministic rule-based extractor (used as fallback or for fast offline processing/testing)
  extractHeuristic(jd: string): Role {
    const lines = jd.split('\n').map((l) => l.trim()).filter(Boolean);
    const firstLine = lines[0] || 'Software Engineer';

    let title = 'Software Engineer';
    let seniority = 'Mid-level';

    if (/senior|sr\.|principal|lead|staff/i.test(firstLine)) {
      title = firstLine.replace(/[-|:,].*$/, '').trim();
      if (/staff/i.test(firstLine)) seniority = 'Staff';
      else if (/principal/i.test(firstLine)) seniority = 'Principal';
      else if (/lead/i.test(firstLine)) seniority = 'Lead';
      else seniority = 'Senior';
    } else if (/junior|jr\.|associate|intern|entry/i.test(firstLine)) {
      title = firstLine.replace(/[-|:,].*$/, '').trim();
      seniority = 'Junior';
    } else if (lines.length > 0) {
      title = firstLine.slice(0, 60);
    }

    const requirements: Requirement[] = [];
    const responsibilities: string[] = [];
    let reqIndex = 1;

    let inRequirementsSection = false;
    let inBonusSection = false;
    let inResponsibilitiesSection = false;

    for (const line of lines) {
      const lower = line.toLowerCase();
      const isBullet = /^[-*•\d+.]\s*(.*)/.exec(line);
      const isSectionHeader = !isBullet && line.endsWith(':');

      if (isSectionHeader || line.length < 30) {
        if (/responsibilit|what you('ll| will) do|duties|the role/i.test(lower)) {
          inResponsibilitiesSection = true;
          inRequirementsSection = false;
          inBonusSection = false;
          continue;
        }
        if (/bonus|nice to have|preferred|plus|optional/i.test(lower) && !isBullet) {
          inBonusSection = true;
          inRequirementsSection = false;
          inResponsibilitiesSection = false;
          continue;
        }
        if (/requirement|qualification|what we('re| are) looking for|must have|skills/i.test(lower) && !isBullet) {
          inRequirementsSection = true;
          inBonusSection = false;
          inResponsibilitiesSection = false;
          continue;
        }
      }

      const content = isBullet ? isBullet[1].trim() : line;

      if (content.length > 8) {
        if (inResponsibilitiesSection && isBullet) {
          responsibilities.push(content);
        } else if (inRequirementsSection || inBonusSection || isBullet) {
          const isNice = inBonusSection || /nice to have|bonus|preferred|optional|plus/i.test(lower);
          let kind: 'technical' | 'behavioural' | 'domain' = 'technical';
          if (/leadership|collaborat|team|mentor|communicat|agile|culture|ownership/i.test(lower)) {
            kind = 'behavioural';
          } else if (/finance|healthcare|fintech|e-commerce|compliance|gdpr|crypto|domain/i.test(lower)) {
            kind = 'domain';
          }

          requirements.push({
            id: `r${reqIndex++}`,
            text: content,
            kind,
            priority: isNice ? 'nice' : 'must',
          });
        }
      }
    }

    // If stub JD with no bullets, extract sentences directly without fabricating
    if (requirements.length === 0) {
      for (const line of lines) {
        if (line.length > 15 && line !== title) {
          const lower = line.toLowerCase();
          const isNice = /nice|bonus|preferred/i.test(lower);
          const kind = /lead|mentor|communicat/i.test(lower) ? 'behavioural' : 'technical';
          requirements.push({
            id: `r${reqIndex++}`,
            text: line,
            kind,
            priority: isNice ? 'nice' : 'must',
          });
        }
      }
    }

    return {
      title: title || 'Software Engineer',
      seniority: seniority || 'Mid-level',
      responsibilities: responsibilities.length > 0 ? responsibilities : ['Design, develop, and maintain core software features.'],
      requirements: requirements.length > 0 ? requirements : [
        { id: 'r1', text: 'Core software engineering fundamentals and problem solving', kind: 'technical', priority: 'must' }
      ],
    };
  }

  async extractRole(jd: string): Promise<Role> {
    if (!this.llm.hasApiKey()) {
      return this.extractHeuristic(jd);
    }

    const prompt = `You are an expert technical recruiter analyzing a job description.
Extract the structured role information strictly from the provided text.
CRITICAL RULES:
1. DO NOT INVENT or hallucinate requirements that are not in the text. If the JD is short or a 2-line stub, report only what is present.
2. For each requirement, determine:
   - "kind": "technical" | "behavioural" | "domain"
   - "priority": "must" | "nice" (Base this faithfully on wording: "required", "qualifications", "must" => "must"; "nice to have", "bonus", "preferred" => "nice").
3. Assign stable sequential IDs: "r1", "r2", "r3", etc.
4. Output strict JSON matching this schema:
{
  "title": "Role Title",
  "seniority": "Junior | Mid-level | Senior | Lead | Staff | Principal",
  "responsibilities": ["list of responsibilities extracted from text"],
  "requirements": [
    {
      "id": "r1",
      "text": "Requirement text",
      "kind": "technical",
      "priority": "must"
    }
  ]
}

JOB DESCRIPTION:
"""
${jd}
"""`;

    try {
      const parsed = await this.llm.generateJson<Role>(prompt, { temperature: 0.1 });
      if (parsed && Array.isArray(parsed.requirements) && parsed.requirements.length > 0) {
        // Ensure stable sequential IDs
        parsed.requirements = parsed.requirements.map((req, idx) => ({
          id: req.id || `r${idx + 1}`,
          text: req.text || 'Requirement',
          kind: ['technical', 'behavioural', 'domain'].includes(req.kind) ? req.kind : 'technical',
          priority: ['must', 'nice'].includes(req.priority) ? req.priority : 'must',
        }));
        return parsed;
      }
      return this.extractHeuristic(jd);
    } catch (err) {
      console.warn('LLM extraction failed, falling back to heuristic extractor:', err);
      return this.extractHeuristic(jd);
    }
  }
}
