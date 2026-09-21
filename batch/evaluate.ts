import fs from 'node:fs';
import path from 'node:path';
import minimist from 'minimist';
import { BatchCase, BatchKitResult, BatchOutputFile, BatchCaseSchema } from '../src/core/types.js';
import { InterviewPrepPipeline } from '../src/core/pipeline.js';

async function main() {
  const argv = minimist(process.argv.slice(2));
  const inputFile = argv.input || argv.i;
  const outputFile = argv.output || argv.o;

  if (!inputFile || !outputFile) {
    console.error('Usage: npm run evaluate -- --input <cases.json> --output <kits.json>');
    process.exit(1);
  }

  const inputPath = path.resolve(process.cwd(), inputFile);
  const outputPath = path.resolve(process.cwd(), outputFile);

  if (!fs.existsSync(inputPath)) {
    console.error(`Input file does not exist: ${inputPath}`);
    process.exit(1);
  }

  let rawData: any;
  try {
    const content = fs.readFileSync(inputPath, 'utf-8');
    rawData = JSON.parse(content);
  } catch (err: any) {
    console.error(`Failed to read/parse input file: ${err.message}`);
    process.exit(1);
  }

  if (!Array.isArray(rawData)) {
    console.error('Input JSON must be an array of cases.');
    process.exit(1);
  }

  const cases: BatchCase[] = [];
  for (let i = 0; i < rawData.length; i++) {
    const parseResult = BatchCaseSchema.safeParse(rawData[i]);
    if (parseResult.success) {
      cases.push(parseResult.data);
    } else {
      console.warn(`Warning: Case at index ${i} has invalid shape:`, parseResult.error.issues);
      cases.push({
        id: rawData[i]?.id || `case-${i + 1}`,
        jd: rawData[i]?.jd || '',
        company_url: rawData[i]?.company_url || '',
        days: Number(rawData[i]?.days) || 5,
      });
    }
  }

  console.log(`[Batch Evaluate] Processing ${cases.length} case(s)...`);
  const pipeline = new InterviewPrepPipeline({ maxCoveragePasses: 2 });
  const results: BatchKitResult[] = [];

  for (let i = 0; i < cases.length; i++) {
    const item = cases[i];
    console.log(`\n[Case ${i + 1}/${cases.length}] ID: ${item.id} (${item.days} days, ${item.company_url})`);

    try {
      const kit = await pipeline.generateKit(
        {
          jd: item.jd,
          company_url: item.company_url,
          days: item.days,
        },
        (progress) => {
          console.log(`  [${item.id}] ${progress.phase}: ${progress.message} (${progress.progressPercent}%)`);
        }
      );

      results.push({
        id: item.id,
        status: 'ok',
        kit,
        error: null,
      });
    } catch (err: any) {
      console.error(`  [${item.id}] Generation failed: ${err.message}`);
      const isUnreachable = /unreachable|ENOTFOUND|ECONNREFUSED|ETIMEDOUT/i.test(err.message);
      results.push({
        id: item.id,
        status: 'failed',
        kit: null,
        error: {
          code: isUnreachable ? 'COMPANY_UNREACHABLE' : 'GENERATION_ERROR',
          message: err.message || 'An unexpected error occurred during kit generation.',
        },
      });
    }
  }

  const output: BatchOutputFile = {
    version: '1.0',
    generated_at: new Date().toISOString(),
    kits: results,
  };

  const outputDir = path.dirname(outputPath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2), 'utf-8');
  console.log(`\n[Batch Evaluate] Finished! Successfully wrote results to: ${outputPath}`);
}

main().catch((err) => {
  console.error('[Batch Evaluate] Fatal error:', err);
  process.exit(1);
});
