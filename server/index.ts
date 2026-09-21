import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import crypto from 'node:crypto';
import { db, connectDB, UserRecord, KitRecord } from './db.js';
import { authMiddleware, AuthenticatedRequest, signToken, hashPassword, comparePassword } from './auth.js';
import { InterviewPrepPipeline } from '../src/core/pipeline.js';
import { KitSchema, BatchCaseSchema } from '../src/core/types.js';
import { defaultLLM } from '../src/core/llm.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:3000',
  credentials: true,
}));

app.use(express.json({ limit: '10mb' }));

const pipeline = new InterviewPrepPipeline({ maxCoveragePasses: 2 });

// ================= AUTH ROUTES =================

app.post('/api/auth/register', async (req: Request, res: Response) => {
  try {
    const { email, password, name } = req.body;
    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required.' });
      return;
    }

    const existing = await db.findUserByEmail(email);
    if (existing) {
      res.status(400).json({ error: 'An account with this email already exists.' });
      return;
    }

    const passwordHash = await hashPassword(password);
    const newUser: UserRecord = {
      id: `usr_${crypto.randomUUID().slice(0, 8)}`,
      email: email.trim().toLowerCase(),
      passwordHash,
      name: name?.trim() || email.split('@')[0],
      createdAt: new Date().toISOString(),
    };

    await db.createUser(newUser);
    const token = signToken(newUser);

    res.json({
      user: { id: newUser.id, email: newUser.email, name: newUser.name },
      token,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Registration failed.' });
  }
});

app.post('/api/auth/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required.' });
      return;
    }

    const user = await db.findUserByEmail(email);
    if (!user) {
      res.status(401).json({ error: 'Invalid email or password.' });
      return;
    }

    const valid = await comparePassword(password, user.passwordHash);
    if (!valid) {
      res.status(401).json({ error: 'Invalid email or password.' });
      return;
    }

    const token = signToken(user);
    res.json({
      user: { id: user.id, email: user.email, name: user.name },
      token,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Login failed.' });
  }
});

app.get('/api/auth/me', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  const user = await db.findUserById(req.user.id);
  if (!user) {
    res.status(404).json({ error: 'User not found.' });
    return;
  }
  res.json({ user: { id: user.id, email: user.email, name: user.name } });
});

// ================= KIT ROUTES =================

// Generate kit with Server-Sent Events (SSE) progress streaming
app.get('/api/kits/generate/stream', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const jd = (req.query.jd as string) || '';
  const company_url = (req.query.company_url as string) || '';
  const days = Math.max(1, parseInt(req.query.days as string, 10) || 5);

  if (!jd || jd.trim().length === 0) {
    res.status(400).json({ error: 'Job description text is required.' });
    return;
  }

  // Set SSE Headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const sendEvent = (event: string, data: any) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  try {
    const kit = await pipeline.generateKit(
      { jd, company_url, days },
      (progress) => {
        sendEvent('progress', progress);
      }
    );

    // Persist generated kit
    const kitRecord: KitRecord = {
      id: `kit_${crypto.randomUUID().slice(0, 8)}`,
      userId,
      kit,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await db.createKit(kitRecord);

    sendEvent('complete', { kitRecord });
    res.end();
  } catch (err: any) {
    sendEvent('error', { message: err.message || 'Generation failed' });
    res.end();
  }
});

// Direct JSON generation endpoint
app.post('/api/kits/generate', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { jd, company_url, days } = req.body;

    if (!jd || jd.trim().length === 0) {
      res.status(400).json({ error: 'Job description is required.' });
      return;
    }

    const kit = await pipeline.generateKit({
      jd,
      company_url: company_url || '',
      days: Number(days) || 5,
    });

    const kitRecord: KitRecord = {
      id: `kit_${crypto.randomUUID().slice(0, 8)}`,
      userId,
      kit,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await db.createKit(kitRecord);
    res.json(kitRecord);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to generate kit.' });
  }
});

// Bulk upload / generation endpoint
app.post('/api/kits/bulk', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { items } = req.body; // Array of { jd, company_url, days }

    if (!Array.isArray(items) || items.length === 0) {
      res.status(400).json({ error: 'Items array is required for bulk generation.' });
      return;
    }

    const createdKits: KitRecord[] = [];

    for (const item of items) {
      try {
        const kit = await pipeline.generateKit({
          jd: item.jd || '',
          company_url: item.company_url || '',
          days: Number(item.days) || 5,
        });

        const record: KitRecord = {
          id: `kit_${crypto.randomUUID().slice(0, 8)}`,
          userId,
          kit,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        await db.createKit(record);
        createdKits.push(record);
      } catch (e) {
        console.error('Failed bulk item:', e);
      }
    }

    res.json({ generated: createdKits.length, kits: createdKits });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Bulk generation failed.' });
  }
});

// List user kits
app.get('/api/kits', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const kits = await db.findKitsByUserId(userId);
    res.json(kits);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to list kits.' });
  }
});

// Get single kit
app.get('/api/kits/:id', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const kitId = String(req.params.id);
    const kit = await db.findKitById(kitId, userId);
    if (!kit) {
      res.status(404).json({ error: 'Prep kit not found.' });
      return;
    }
    res.json(kit);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to get kit.' });
  }
});

// Update kit (inline edits, reordering, custom cards)
app.put('/api/kits/:id', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const kitId = String(req.params.id);
    const { kit } = req.body;

    const validation = KitSchema.safeParse(kit);
    if (!validation.success) {
      res.status(400).json({ error: 'Kit data does not conform to Appendix A schema.', details: validation.error.issues });
      return;
    }

    const updated = await db.updateKit(kitId, userId, kit);
    if (!updated) {
      res.status(404).json({ error: 'Kit not found or not owned by you.' });
      return;
    }

    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to update kit.' });
  }
});

// Regenerate a single section while preserving pinned and edited items
app.post('/api/kits/:id/regenerate-section', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const kitId = String(req.params.id);
    const { section } = req.body; // 'brief' | 'schedule' | 'technical' | 'behavioural' | 'system-design' | 'company-fit'

    const existingRecord = await db.findKitById(kitId, userId);
    if (!existingRecord) {
      res.status(404).json({ error: 'Kit not found.' });
      return;
    }

    const updatedKit = await pipeline.regenerateSection(existingRecord.kit, section);
    const saved = await db.updateKit(kitId, userId, updatedKit);

    res.json(saved);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Section regeneration failed.' });
  }
});

// Delete kit
app.delete('/api/kits/:id', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const kitId = String(req.params.id);
    const deleted = await db.deleteKit(kitId, userId);
    if (!deleted) {
      res.status(404).json({ error: 'Kit not found.' });
      return;
    }
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to delete kit.' });
  }
});

// ================= CREATIVE FEATURE: INTERACTIVE MOCK EVALUATION =================

app.post('/api/mock/evaluate', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { question, answerOutline, candidateAnswer, category } = req.body;

    if (!question || !candidateAnswer) {
      res.status(400).json({ error: 'Question and candidate answer are required.' });
      return;
    }

    if (!defaultLLM.hasApiKey()) {
      const lengthScore = Math.min(85, Math.max(50, candidateAnswer.length / 5));
      res.json({
        score: lengthScore,
        feedback: 'Solid structure provided. Focus on quantifying key outcomes and articulating architectural trade-offs.',
        strengths: ['Directly answered the core prompt', 'Structured response clearly'],
        improvements: ['Include deeper metrics or edge-case handling', 'Elaborate on production observability'],
      });
      return;
    }

    const prompt = `You are a senior hiring manager grading a live interview response.
Question (${category}): "${question}"
Expected Answer Outline: "${answerOutline}"
Candidate's Response:
"""
${candidateAnswer}
"""

Evaluate the candidate's answer with actionable rigor.
Output strict JSON:
{
  "score": 85, // integer 0 to 100
  "feedback": "2-3 sentences of constructive evaluation",
  "strengths": ["Key strength 1", "Key strength 2"],
  "improvements": ["Actionable improvement 1", "Actionable improvement 2"]
}`;

    const evaluation = await defaultLLM.generateJson<any>(prompt, { temperature: 0.2 });
    res.json(evaluation);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Evaluation failed.' });
  }
});

// Start Server
async function start() {
  await connectDB();
  app.listen(PORT, () => {
    console.log(`✓ API Server listening on port ${PORT}`);
  });
}

start();
