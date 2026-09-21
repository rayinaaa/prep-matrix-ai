import { Kit, BatchCase, GenerationProgressCallback, Question, Flashcard, Requirement } from './types.js';
import { CompanyCrawler } from './crawler.js';
import { RoleExtractor } from './extractor.js';
import { KitGenerator } from './generator.js';
import { CoverageEngine } from './coverage.js';
import { DeterministicScheduler } from './scheduler.js';
import { defaultLLM, LLMClient } from './llm.js';

export interface PipelineOptions {
  llm?: LLMClient;
  maxCoveragePasses?: number;
  onProgress?: GenerationProgressCallback;
}

export class InterviewPrepPipeline {
  private crawler: CompanyCrawler;
  private extractor: RoleExtractor;
  private generator: KitGenerator;
  private coverageEngine: CoverageEngine;
  private scheduler: DeterministicScheduler;
  private maxCoveragePasses: number;

  constructor(options: PipelineOptions = {}) {
    const llm = options.llm || defaultLLM;
    this.crawler = new CompanyCrawler();
    this.extractor = new RoleExtractor(llm);
    this.generator = new KitGenerator(llm);
    this.coverageEngine = new CoverageEngine(llm);
    this.scheduler = new DeterministicScheduler();
    this.maxCoveragePasses = options.maxCoveragePasses || 2;
  }

  async generateKit(
    input: { jd: string; company_url: string; days: number },
    onProgress?: GenerationProgressCallback
  ): Promise<Kit> {
    const { jd, company_url, days } = input;
    const jdChars = jd ? jd.length : 0;
    const researchedAt = new Date().toISOString();

    // Step 1: Crawl company website
    onProgress?.({
      phase: 'crawling',
      message: `Analyzing and crawling company site at ${company_url || 'provided URL'}...`,
      progressPercent: 15,
    });

    const research = await this.crawler.crawlCompany(company_url, (msg) => {
      onProgress?.({
        phase: 'crawling',
        message: msg,
        progressPercent: 20,
      });
    });

    // Step 2: Extract requirements from JD
    onProgress?.({
      phase: 'extraction',
      message: 'Extracting structured role requirements and classifying priorities...',
      progressPercent: 35,
    });

    const role = await this.extractor.extractRole(jd);

    // Step 3: Generate Company Brief
    onProgress?.({
      phase: 'generation_pass_1',
      message: 'Synthesizing company brief and hiring intelligence...',
      progressPercent: 45,
    });

    const companyBrief = await this.generator.generateCompanyBrief(company_url, research, role.title);

    // Step 4: First pass question & flashcard generation
    onProgress?.({
      phase: 'generation_pass_1',
      message: 'Generating categorized question banks (Technical, System Design, Behavioural, Culture)...',
      progressPercent: 60,
    });

    let allQuestions: Question[] = [];
    const categories: ('technical' | 'behavioural' | 'system-design' | 'company-fit')[] = [
      'technical',
      'system-design',
      'behavioural',
      'company-fit',
    ];

    for (const cat of categories) {
      const catQuestions = await this.generator.generateQuestionsForCategory(
        cat,
        role,
        companyBrief,
        allQuestions.length
      );
      allQuestions.push(...catQuestions);
    }

    const flashcards = await this.generator.generateFlashcards(role, allQuestions);

    // Step 5: Deterministic Coverage Check & Second Pass Loop
    onProgress?.({
      phase: 'coverage_check',
      message: 'Running deterministic coverage check to audit must-have requirements...',
      progressPercent: 75,
    });

    let passCount = 1;
    let coverageAnalysis = this.coverageEngine.analyzeCoverage(role.requirements, allQuestions);

    while (
      passCount < this.maxCoveragePasses &&
      coverageAnalysis.uncoveredMustRequirementIds.length > 0
    ) {
      passCount++;
      onProgress?.({
        phase: 'generation_pass_2',
        message: `Pass ${passCount}: Closing coverage gaps for ${coverageAnalysis.uncoveredMustRequirementIds.length} must-have requirement(s)...`,
        progressPercent: 85,
      });

      const uncoveredReqObjs = role.requirements.filter((r) =>
        coverageAnalysis.uncoveredMustRequirementIds.includes(r.id)
      );

      const gapQuestions = await this.coverageEngine.generateGapQuestions(
        uncoveredReqObjs,
        role.title,
        allQuestions.length
      );

      allQuestions.push(...gapQuestions);
      coverageAnalysis = this.coverageEngine.analyzeCoverage(role.requirements, allQuestions);
    }

    // Step 6: Deterministic Schedule Allocation
    onProgress?.({
      phase: 'scheduling',
      message: `Distributing preparation schedule across ${days} days...`,
      progressPercent: 95,
    });

    const schedule = this.scheduler.generateSchedule(days, allQuestions, role.requirements);

    const kit: Kit = {
      source: {
        company: research.companyName || 'Target Company',
        company_url: research.companyUrl || company_url || '',
        role: role.title || 'Target Role',
        location: 'Remote / Unspecified',
        jd_chars: jdChars,
        researched_at: researchedAt,
        pages_used: research.sources,
      },
      company_brief: {
        summary: companyBrief.summary,
        what_they_do: companyBrief.what_they_do,
        sources: companyBrief.sources,
      },
      role,
      questions: allQuestions,
      flashcards,
      schedule,
      coverage: {
        uncovered_requirement_ids: coverageAnalysis.uncoveredRequirementIds,
        passes: passCount,
      },
    };

    onProgress?.({
      phase: 'complete',
      message: 'Interview preparation kit ready!',
      progressPercent: 100,
      data: kit,
    });

    return kit;
  }

  // Section regeneration preserving pinned and user-edited items
  async regenerateSection(
    currentKit: Kit,
    section: 'brief' | 'schedule' | 'technical' | 'behavioural' | 'system-design' | 'company-fit'
  ): Promise<Kit> {
    const updatedKit: Kit = JSON.parse(JSON.stringify(currentKit));

    if (section === 'brief') {
      const research: any = {
        companyName: currentKit.source.company,
        companyUrl: currentKit.source.company_url,
        pagesCrawled: currentKit.source.pages_used.map((url) => ({
          url,
          cleanedText: currentKit.company_brief.what_they_do,
          discoveredLinks: [],
        })),
        sources: currentKit.company_brief.sources,
      };
      const newBrief = await this.generator.generateCompanyBrief(
        currentKit.source.company_url,
        research,
        currentKit.role.title
      );
      updatedKit.company_brief = newBrief;
    } else if (section === 'schedule') {
      updatedKit.schedule = this.scheduler.generateSchedule(
        currentKit.schedule.days_available,
        currentKit.questions,
        currentKit.role.requirements
      );
    } else {
      // Regenerate specific question category while PRESERVING user-edited and pinned items
      const category = section;
      const preservedQuestions = currentKit.questions.filter(
        (q) => q.category !== category || q.is_pinned || q.is_edited || q.is_custom
      );

      const newCatQuestions = await this.generator.generateQuestionsForCategory(
        category,
        currentKit.role,
        currentKit.company_brief,
        currentKit.questions.length
      );

      updatedKit.questions = [...preservedQuestions, ...newCatQuestions];

      // Re-run deterministic coverage & update schedule
      const coverageAnalysis = this.coverageEngine.analyzeCoverage(
        updatedKit.role.requirements,
        updatedKit.questions
      );
      updatedKit.coverage.uncovered_requirement_ids = coverageAnalysis.uncoveredRequirementIds;

      updatedKit.schedule = this.scheduler.generateSchedule(
        updatedKit.schedule.days_available,
        updatedKit.questions,
        updatedKit.role.requirements
      );
    }

    return updatedKit;
  }
}
