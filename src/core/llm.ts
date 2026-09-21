import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
dotenv.config();

export interface LLMRequestOptions {
  temperature?: number;
  maxTokens?: number;
  jsonMode?: boolean;
}

// Token bucket / Rate limiting helper to respect free tier boundaries
class RateLimiter {
  private queue: (() => Promise<void>)[] = [];
  private isProcessing = false;
  private minIntervalMs: number;
  private lastCallTime = 0;

  constructor(requestsPerMinute = 15) {
    this.minIntervalMs = Math.ceil(60000 / requestsPerMinute) + 200; // safety margin
  }

  async acquire(): Promise<void> {
    return new Promise((resolve) => {
      this.queue.push(async () => {
        const now = Date.now();
        const elapsed = now - this.lastCallTime;
        if (elapsed < this.minIntervalMs) {
          await new Promise((r) => setTimeout(r, this.minIntervalMs - elapsed));
        }
        this.lastCallTime = Date.now();
        resolve();
      });
      this.processQueue();
    });
  }

  private async processQueue() {
    if (this.isProcessing || this.queue.length === 0) return;
    this.isProcessing = true;
    while (this.queue.length > 0) {
      const nextTask = this.queue.shift();
      if (nextTask) await nextTask();
    }
    this.isProcessing = false;
  }
}

const geminiLimiter = new RateLimiter(14); // Stay safely below standard 15 RPM free tier

export class LLMClient {
  private genAI: GoogleGenerativeAI | null = null;
  private modelName: string;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey && apiKey !== 'your_gemini_api_key_here') {
      this.genAI = new GoogleGenerativeAI(apiKey);
    }
    this.modelName = process.env.GEMINI_MODEL || 'gemini-1.5-flash';
  }

  hasApiKey(): boolean {
    return !!this.genAI;
  }

  cleanJsonString(raw: string): string {
    let clean = raw.trim();
    // Remove markdown code fences ```json ... ```
    if (clean.startsWith('```')) {
      clean = clean.replace(/^```[a-zA-Z]*\n?/, '').replace(/```\s*$/, '').trim();
    }
    return clean;
  }

  async generateText(prompt: string, options: LLMRequestOptions = {}): Promise<string> {
    if (!this.genAI) {
      throw new Error('GEMINI_API_KEY is not configured in .env');
    }

    const maxRetries = 4;
    let attempt = 0;
    let delayMs = 2000;

    while (attempt < maxRetries) {
      try {
        await geminiLimiter.acquire();
        const model = this.genAI.getGenerativeModel({
          model: this.modelName,
          generationConfig: {
            temperature: options.temperature ?? 0.2,
            responseMimeType: options.jsonMode ? 'application/json' : 'text/plain',
          },
        });

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();
        return options.jsonMode ? this.cleanJsonString(text) : text;
      } catch (err: any) {
        attempt++;
        const isRateLimit = err.status === 429 || /rate|quota|too many/i.test(err.message || '');
        if (isRateLimit && attempt < maxRetries) {
          console.warn(`[LLM] Rate limit encountered. Backing off for ${delayMs}ms (Attempt ${attempt}/${maxRetries})...`);
          await new Promise((r) => setTimeout(r, delayMs));
          delayMs *= 2; // exponential backoff
          continue;
        }
        if (attempt >= maxRetries) {
          throw new Error(`LLM generation failed after ${maxRetries} attempts: ${err.message}`);
        }
        throw err;
      }
    }
    throw new Error('LLM call failed unexpectedly');
  }

  async generateJson<T>(prompt: string, options: LLMRequestOptions = {}): Promise<T> {
    const rawJson = await this.generateText(prompt, { ...options, jsonMode: true });
    try {
      return JSON.parse(rawJson) as T;
    } catch (parseError) {
      // Attempt heuristic JSON extraction if wrapper characters remain
      const match = rawJson.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
      if (match) {
        return JSON.parse(match[0]) as T;
      }
      throw new Error(`Failed to parse LLM JSON output: ${rawJson.slice(0, 200)}...`);
    }
  }
}

export const defaultLLM = new LLMClient();
