import axios from 'axios';
import * as cheerio from 'cheerio';
import robotsParser from 'robots-parser';
import { CrawlResult, ResearchSummary } from './types.js';

// SSRF prevention: Validate external URLs
export function isSafeUrl(urlStr: string, allowLocal = false): { safe: boolean; reason?: string } {
  try {
    const parsed = new URL(urlStr);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return { safe: false, reason: `Invalid protocol: ${parsed.protocol}` };
    }

    const hostname = parsed.hostname.toLowerCase();

    if (!allowLocal && process.env.NODE_ENV === 'production') {
      // Reject loopback and private networks in production
      if (
        hostname === 'localhost' ||
        hostname === '127.0.0.1' ||
        hostname === '::1' ||
        hostname.startsWith('10.') ||
        hostname.startsWith('192.168.') ||
        /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(hostname) ||
        hostname.endsWith('.local')
      ) {
        return { safe: false, reason: 'Private and loopback addresses are blocked in production' };
      }
    }

    return { safe: true };
  } catch (err: any) {
    return { safe: false, reason: `Malformed URL: ${err.message}` };
  }
}

// Clean HTML content to plain concise text
export function cleanHtmlContent(html: string): { title: string; text: string; links: string[] } {
  const $ = cheerio.load(html);

  // Remove irrelevant noise
  $('script, style, svg, noscript, iframe, link, meta, nav, footer, header, form, button').remove();

  const title = $('title').text().trim() || $('h1').first().text().trim() || '';

  // Extract all hyperlinks
  const links: string[] = [];
  $('a[href]').each((_, el) => {
    const href = $(el).attr('href');
    if (href && !href.startsWith('mailto:') && !href.startsWith('tel:') && !href.startsWith('#') && !href.startsWith('javascript:')) {
      links.push(href.trim());
    }
  });

  // Extract main text content
  const bodyText = $('body').text() || $.text();
  const cleanedText = bodyText
    .replace(/\s+/g, ' ')
    .replace(/(\n\s*){2,}/g, '\n')
    .trim()
    .slice(0, 15000); // cap text size to avoid token blowup

  return { title, text: cleanedText, links: Array.from(new Set(links)) };
}

// Score links to discover careers/jobs/about/handbook pages
export function scoreLink(href: string, baseOrigin: string): number {
  const lower = href.toLowerCase();
  let score = 0;

  // High priority hiring & company process indicators
  if (lower.includes('career') || lower.includes('/jobs') || lower.includes('join-us') || lower.includes('work-with-us')) score += 50;
  if (lower.includes('hiring') || lower.includes('interview') || lower.includes('engineering-ladder') || lower.includes('handbook')) score += 60;
  if (lower.includes('about') || lower.includes('company') || lower.includes('team') || lower.includes('culture') || lower.includes('values')) score += 30;
  if (lower.includes('blog') || lower.includes('engineering') || lower.includes('tech-stack') || lower.includes('how-we-work')) score += 25;
  if (lower.includes('press') || lower.includes('news') || lower.includes('product')) score += 10;

  // Demote social media / utility links
  if (lower.includes('terms') || lower.includes('privacy') || lower.includes('login') || lower.includes('signup') || lower.includes('cookie')) score -= 40;
  if (lower.includes('facebook.com') || lower.includes('twitter.com') || lower.includes('instagram.com') || lower.includes('youtube.com')) score -= 50;

  // Bonus for internal relative or same-domain links
  try {
    const fullUrl = new URL(href, baseOrigin);
    if (fullUrl.origin === baseOrigin) {
      score += 15;
    }
  } catch {
    // ignore
  }

  return score;
}

export class CompanyCrawler {
  private userAgent = 'TraoInterviewPrepBot/1.0 (+https://trao.ai/bot)';
  private timeoutMs = 8000;
  private maxPagesToCrawl = 4;

  async checkRobotsTxt(baseUrl: string): Promise<any> {
    try {
      const parsed = new URL(baseUrl);
      const robotsUrl = `${parsed.origin}/robots.txt`;
      const response = await axios.get(robotsUrl, {
        timeout: 4000,
        headers: { 'User-Agent': this.userAgent },
        validateStatus: (s) => s < 500,
      });

      if (response.status === 200 && typeof response.data === 'string') {
        const parserFn = (robotsParser as any).default || robotsParser;
        return parserFn(robotsUrl, response.data);
      }
    } catch {
      // Robots.txt missing or unreachable is common, proceed safely
    }
    return null;
  }

  async fetchSinglePage(targetUrl: string, robots: any = null): Promise<CrawlResult> {
    const safety = isSafeUrl(targetUrl, true);
    if (!safety.safe) {
      return {
        url: targetUrl,
        cleanedText: '',
        discoveredLinks: [],
        error: safety.reason,
      };
    }

    if (robots && !robots.isAllowed(targetUrl, this.userAgent)) {
      return {
        url: targetUrl,
        cleanedText: '',
        discoveredLinks: [],
        error: 'Disallowed by robots.txt',
      };
    }

    try {
      const response = await axios.get(targetUrl, {
        timeout: this.timeoutMs,
        maxRedirects: 5,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
        maxContentLength: 5 * 1024 * 1024, // 5MB cap
        validateStatus: (s) => s >= 200 && s < 400,
      });

      const contentType = String(response.headers['content-type'] || '');
      if (!contentType.includes('text/html') && !contentType.includes('text/plain') && !contentType.includes('application/xhtml+xml')) {
        return {
          url: targetUrl,
          statusCode: response.status,
          cleanedText: '',
          discoveredLinks: [],
          error: `Skipped non-HTML content-type: ${contentType}`,
        };
      }

      const { title, text, links } = cleanHtmlContent(response.data);
      const isHiring = /careers|hiring|interview|engineering|job|handbook|values|culture/i.test(targetUrl + ' ' + title);

      return {
        url: targetUrl,
        statusCode: response.status,
        title,
        cleanedText: text,
        discoveredLinks: links,
        isHiringPage: isHiring,
      };
    } catch (err: any) {
      const message = err.response ? `HTTP ${err.response.status}` : err.code === 'ECONNABORTED' ? 'Request timed out' : err.message;
      return {
        url: targetUrl,
        cleanedText: '',
        discoveredLinks: [],
        error: message,
      };
    }
  }

  async crawlCompany(startUrl: string, onProgress?: (msg: string) => void): Promise<ResearchSummary> {
    const pagesCrawled: CrawlResult[] = [];
    const visited = new Set<string>();
    const sources: string[] = [];

    if (!startUrl || startUrl.trim() === '') {
      return {
        companyName: '',
        companyUrl: '',
        pagesCrawled: [],
        publicDiscussionSnippets: [],
        sources: [],
      };
    }

    let normalizedStartUrl = startUrl.trim();
    if (!normalizedStartUrl.startsWith('http://') && !normalizedStartUrl.startsWith('https://')) {
      normalizedStartUrl = `https://${normalizedStartUrl}`;
    }

    let parsedStart: URL;
    try {
      parsedStart = new URL(normalizedStartUrl);
    } catch {
      return {
        companyName: '',
        companyUrl: startUrl,
        pagesCrawled: [{
          url: startUrl,
          cleanedText: '',
          discoveredLinks: [],
          error: 'Invalid URL format',
        }],
        publicDiscussionSnippets: [],
        sources: [],
      };
    }

    onProgress?.(`Inspecting ${parsedStart.origin} (checking robots.txt and homepage)...`);
    const robots = await this.checkRobotsTxt(normalizedStartUrl);

    // Fetch homepage / entry page
    const homeResult = await this.fetchSinglePage(normalizedStartUrl, robots);
    pagesCrawled.push(homeResult);
    visited.add(normalizedStartUrl);
    if (!homeResult.error) sources.push(normalizedStartUrl);

    // Discover and score links
    const candidates: { url: string; score: number }[] = [];
    for (const rawLink of homeResult.discoveredLinks) {
      try {
        const fullUrlObj = new URL(rawLink, normalizedStartUrl);
        const fullUrl = fullUrlObj.href;

        // Skip non-HTTP, fragments, or already visited
        if (!['http:', 'https:'].includes(fullUrlObj.protocol) || visited.has(fullUrl)) continue;

        const score = scoreLink(fullUrl, parsedStart.origin);
        if (score > 0) {
          candidates.push({ url: fullUrl, score });
        }
      } catch {
        // ignore
      }
    }

    // Sort descending by score
    candidates.sort((a, b) => b.score - a.score);

    // Pick top links to fetch (e.g. careers, handbook, about, blog)
    const toFetch = candidates.slice(0, this.maxPagesToCrawl - 1);

    for (const item of toFetch) {
      if (visited.has(item.url)) continue;
      visited.add(item.url);
      onProgress?.(`Crawling discovered hiring/about link: ${item.url}`);
      const pageResult = await this.fetchSinglePage(item.url, robots);
      pagesCrawled.push(pageResult);
      if (!pageResult.error && pageResult.cleanedText.length > 50) {
        sources.push(item.url);
      }
    }

    // Deduce company name from title or hostname
    let companyName = '';
    if (homeResult.title) {
      // Split on common separators: "Acme Corp | Building the Future" -> "Acme Corp"
      const parts = homeResult.title.split(/[-|:–—·•]/);
      companyName = parts[0].trim();
    }
    if (!companyName || companyName.length > 40) {
      companyName = parsedStart.hostname.replace(/^www\./, '').split('.')[0];
      companyName = companyName.charAt(0).toUpperCase() + companyName.slice(1);
    }

    return {
      companyName,
      companyUrl: normalizedStartUrl,
      pagesCrawled,
      publicDiscussionSnippets: [],
      sources: Array.from(new Set(sources)),
    };
  }
}
