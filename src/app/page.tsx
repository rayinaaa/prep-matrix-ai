'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../context/AuthContext';
import {
  Sparkles,
  Globe,
  FileText,
  Calendar,
  UploadCloud,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ArrowRight,
  Layers,
  Clock,
  ExternalLink,
  Trash2,
  BookOpen
} from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

export default function HomePage() {
  const router = useRouter();
  const { user, token } = useAuth();

  // Form State
  const [jd, setJd] = useState('');
  const [companyUrl, setCompanyUrl] = useState('');
  const [days, setDays] = useState(5);
  const [activeTab, setActiveTab] = useState<'single' | 'bulk'>('single');

  // Bulk Upload State
  const [bulkFileJson, setBulkFileJson] = useState<any[] | null>(null);
  const [bulkFileName, setBulkFileName] = useState('');

  // Generation Progress & State
  const [isGenerating, setIsGenerating] = useState(false);
  const [progressPercent, setProgressPercent] = useState(0);
  const [progressMessage, setProgressMessage] = useState('');
  const [progressPhase, setProgressPhase] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // User's existing kits
  const [savedKits, setSavedKits] = useState<any[]>([]);
  const [loadingKits, setLoadingKits] = useState(false);

  useEffect(() => {
    if (token) {
      loadKits();
    }
  }, [token]);

  const loadKits = async () => {
    if (!token) return;
    setLoadingKits(true);
    try {
      const res = await fetch(`${API_BASE}/kits`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setSavedKits(data);
      }
    } catch (e) {
      console.error('Failed to load kits', e);
    } finally {
      setLoadingKits(false);
    }
  };

  const handleSingleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!jd.trim()) {
      setErrorMsg('Please paste the job description text.');
      return;
    }

    if (!token) {
      setErrorMsg('Please Sign In or Create an Account to generate and save your prep kit.');
      return;
    }

    setErrorMsg('');
    setIsGenerating(true);
    setProgressPercent(10);
    setProgressMessage('Initiating crawler and research pipeline...');
    setProgressPhase('crawling');

    try {
      // Connect to SSE stream
      const queryParams = new URLSearchParams({
        jd,
        company_url: companyUrl,
        days: days.toString(),
      });

      // We use EventSource for live progress updates
      const eventSource = new EventSource(`${API_BASE}/kits/generate/stream?${queryParams.toString()}`);

      // If needed, pass auth via cookie or query; our backend supports direct stream with token or fallback to POST
      // To ensure robust auth in all environments, fallback to POST with streaming simulation or EventSource:
      const res = await fetch(`${API_BASE}/kits/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ jd, company_url: companyUrl, days }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Kit generation failed');
      }

      setProgressPercent(100);
      setProgressMessage('Kit generated successfully! Loading your kit...');
      setTimeout(() => {
        router.push(`/kit/${data.id}`);
      }, 500);
    } catch (err: any) {
      setErrorMsg(err.message || 'Generation failed');
      setIsGenerating(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBulkFileName(file.name);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        const parsed = JSON.parse(content);
        if (Array.isArray(parsed)) {
          setBulkFileJson(parsed);
          setErrorMsg('');
        } else {
          setErrorMsg('File must contain a valid JSON array of { jd, company_url, days } objects.');
        }
      } catch {
        setErrorMsg('Invalid JSON file format.');
      }
    };
    reader.readAsText(file);
  };

  const handleBulkSubmit = async () => {
    if (!bulkFileJson || bulkFileJson.length === 0) {
      setErrorMsg('Please upload a valid JSON array file.');
      return;
    }

    if (!token) {
      setErrorMsg('Please Sign In first.');
      return;
    }

    setIsGenerating(true);
    setProgressPercent(30);
    setProgressMessage(`Batch processing ${bulkFileJson.length} roles...`);

    try {
      const res = await fetch(`${API_BASE}/kits/bulk`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ items: bulkFileJson }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Bulk generation failed');

      setIsGenerating(false);
      loadKits();
      setBulkFileJson(null);
      setBulkFileName('');
      alert(`Successfully created ${data.generated} prep kit(s)!`);
    } catch (err: any) {
      setErrorMsg(err.message || 'Bulk processing failed');
      setIsGenerating(false);
    }
  };

  const handleDeleteKit = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this kit?')) return;
    try {
      await fetch(`${API_BASE}/kits/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      loadKits();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:py-12">
      {/* Hero Header */}
      <div className="text-center max-w-3xl mx-auto space-y-3 mb-10">
        <div className="inline-flex items-center gap-2 rounded-full border border-brand-500/30 bg-brand-500/10 px-3.5 py-1 text-xs font-semibold text-brand-400">
          <Sparkles className="h-3.5 w-3.5" />
          <span>Autonomous AI-Powered Interview Preparation</span>
        </div>
        <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-white">
          Turn Any Job Description Into a <span className="gradient-text">Mastery Prep Kit</span>
        </h1>
        <p className="text-sm sm:text-base text-slate-400 leading-relaxed">
          Crawls target company domains, extracts verified requirements, enforces two-pass coverage, and generates a day-by-day study schedule with interactive flashcards.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Main Creation Card */}
        <div className="lg:col-span-7 bg-slate-900/80 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-xl backdrop-blur-md">
          {/* Tabs: Single vs Bulk */}
          <div className="flex border-b border-slate-800 pb-4 mb-6 gap-6 text-sm font-medium">
            <button
              type="button"
              onClick={() => setActiveTab('single')}
              className={`flex items-center gap-2 pb-2 transition-all relative ${
                activeTab === 'single'
                  ? 'text-brand-400 font-semibold after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-brand-500'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <FileText className="h-4 w-4" />
              <span>Single Role Kit</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('bulk')}
              className={`flex items-center gap-2 pb-2 transition-all relative ${
                activeTab === 'bulk'
                  ? 'text-brand-400 font-semibold after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-brand-500'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <UploadCloud className="h-4 w-4" />
              <span>Bulk Multi-Role Upload</span>
            </button>
          </div>

          {errorMsg && (
            <div className="mb-6 flex items-start gap-3 rounded-xl border border-red-500/30 bg-red-500/10 p-3.5 text-xs text-red-300">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-red-400" />
              <div>{errorMsg}</div>
            </div>
          )}

          {activeTab === 'single' ? (
            <form onSubmit={handleSingleGenerate} className="space-y-5">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5 flex items-center justify-between">
                  <span>Job Description *</span>
                  <span className="text-[11px] font-normal text-slate-500">{jd.length} chars</span>
                </label>
                <textarea
                  rows={7}
                  required
                  value={jd}
                  onChange={(e) => setJd(e.target.value)}
                  placeholder="Paste the complete job description text here (including responsibilities, requirements, and preferred skills)..."
                  className="w-full rounded-xl border border-slate-700 bg-slate-950/60 p-3.5 text-sm text-slate-100 placeholder-slate-500 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 transition-all resize-y"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5 flex items-center gap-1.5">
                    <Globe className="h-3.5 w-3.5 text-brand-400" />
                    <span>Company Website URL</span>
                  </label>
                  <input
                    type="text"
                    value={companyUrl}
                    onChange={(e) => setCompanyUrl(e.target.value)}
                    placeholder="e.g. https://posthog.com"
                    className="w-full rounded-xl border border-slate-700 bg-slate-950/60 px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                  />
                  <p className="mt-1 text-[11px] text-slate-500">Autonomous crawler discovers /careers, /about, & handbook</p>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5 text-brand-400" />
                      <span>Days Available</span>
                    </span>
                    <span className="text-xs font-bold text-brand-400 bg-brand-500/10 px-2 py-0.5 rounded border border-brand-500/20">
                      {days} {days === 1 ? 'Day' : 'Days'}
                    </span>
                  </label>
                  <input
                    type="range"
                    min={1}
                    max={60}
                    value={days}
                    onChange={(e) => setDays(Number(e.target.value))}
                    className="w-full accent-brand-500 cursor-pointer mt-2"
                  />
                  <div className="flex justify-between text-[10px] text-slate-500 mt-1">
                    <span>1d (Rush)</span>
                    <span>5d (Standard)</span>
                    <span>14d</span>
                    <span>60d</span>
                  </div>
                </div>
              </div>

              {/* Live Generating Progress Box */}
              {isGenerating && (
                <div className="rounded-xl border border-brand-500/30 bg-dark-900/90 p-4 space-y-3">
                  <div className="flex items-center justify-between text-xs font-medium">
                    <span className="flex items-center gap-2 text-brand-300">
                      <Loader2 className="h-4 w-4 animate-spin text-brand-400" />
                      <span>{progressMessage}</span>
                    </span>
                    <span className="font-bold text-white">{progressPercent}%</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800">
                    <div
                      className="h-full bg-gradient-to-r from-brand-500 to-emerald-400 transition-all duration-300 ease-out"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                  <div className="grid grid-cols-4 gap-2 text-[10px] text-slate-400 pt-1 border-t border-slate-800">
                    <div className={progressPercent >= 20 ? 'text-brand-400 font-semibold' : ''}>1. Site Crawl</div>
                    <div className={progressPercent >= 40 ? 'text-brand-400 font-semibold' : ''}>2. Extraction</div>
                    <div className={progressPercent >= 75 ? 'text-brand-400 font-semibold' : ''}>3. Gap Audit</div>
                    <div className={progressPercent >= 95 ? 'text-brand-400 font-semibold' : ''}>4. Scheduling</div>
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={isGenerating}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-brand-500 to-emerald-500 py-3.5 text-sm font-bold text-dark-950 hover:from-brand-400 hover:to-emerald-400 shadow-lg shadow-brand-500/25 transition-all active:scale-[0.99] disabled:opacity-50"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Synthesizing Interview Kit...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    <span>Generate AI Prep Kit</span>
                    <ArrowRight className="h-4 w-4 ml-1" />
                  </>
                )}
              </button>
            </form>
          ) : (
            /* Bulk Upload Tab */
            <div className="space-y-5">
              <div className="rounded-xl border-2 border-dashed border-slate-700 hover:border-brand-500/50 bg-slate-950/40 p-8 text-center transition-colors">
                <UploadCloud className="mx-auto h-10 w-10 text-slate-400" />
                <h4 className="mt-3 text-sm font-semibold text-white">Upload Multi-Role JSON File</h4>
                <p className="mt-1 text-xs text-slate-400">
                  Select a JSON file containing an array of <code className="text-brand-300">{"{ jd, company_url, days }"}</code>
                </p>
                <input
                  type="file"
                  accept=".json"
                  onChange={handleFileUpload}
                  className="mt-4 block w-full text-xs text-slate-400 file:mr-4 file:rounded-lg file:border-0 file:bg-brand-500 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-dark-950 hover:file:bg-brand-400 cursor-pointer"
                />
              </div>

              {bulkFileName && (
                <div className="flex items-center justify-between rounded-lg border border-slate-700 bg-slate-800/60 p-3 text-xs">
                  <div className="flex items-center gap-2 text-slate-200">
                    <CheckCircle2 className="h-4 w-4 text-brand-400" />
                    <span>{bulkFileName}</span>
                    <span className="text-slate-400">({bulkFileJson?.length || 0} cases loaded)</span>
                  </div>
                </div>
              )}

              <button
                type="button"
                onClick={handleBulkSubmit}
                disabled={isGenerating || !bulkFileJson}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-brand-500 py-3 text-sm font-bold text-dark-950 hover:bg-brand-400 disabled:opacity-50 transition-all"
              >
                {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
                <span>Process & Generate All Cases</span>
              </button>
            </div>
          )}
        </div>

        {/* Sidebar / Your Saved Kits */}
        <div className="lg:col-span-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Layers className="h-4 w-4 text-brand-400" />
              <span>Your Saved Prep Kits</span>
            </h3>
            <span className="text-xs text-slate-400">{savedKits.length} kits</span>
          </div>

          {!token ? (
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-6 text-center text-xs text-slate-400">
              <BookOpen className="mx-auto h-8 w-8 text-slate-500 mb-2" />
              <p>Sign in to view, edit, and practice your saved interview kits across devices.</p>
            </div>
          ) : loadingKits ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-brand-400" />
            </div>
          ) : savedKits.length === 0 ? (
            <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-8 text-center text-xs text-slate-400">
              No interview kits yet. Paste a job description to the left to generate your first kit!
            </div>
          ) : (
            <div className="space-y-3 max-h-[540px] overflow-y-auto pr-1">
              {savedKits.map((item) => (
                <div
                  key={item.id}
                  onClick={() => router.push(`/kit/${item.id}`)}
                  className="group relative cursor-pointer rounded-xl border border-slate-800 bg-slate-900/70 p-4 transition-all hover:border-brand-500/40 hover:bg-slate-850 hover:shadow-lg hover:shadow-brand-500/5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-xs font-semibold text-brand-400 uppercase tracking-wider">
                        {item.kit.source.company || 'Target Company'}
                      </div>
                      <h4 className="text-sm font-bold text-white group-hover:text-brand-300 transition-colors">
                        {item.kit.role.title}
                      </h4>
                    </div>
                    <button
                      onClick={(e) => handleDeleteKit(item.id, e)}
                      title="Delete kit"
                      className="rounded p-1 text-slate-500 opacity-0 group-hover:opacity-100 hover:text-red-400 transition-all"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  <div className="mt-3 flex items-center gap-4 text-[11px] text-slate-400 border-t border-slate-800/80 pt-2.5">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3 text-slate-500" />
                      {item.kit.schedule.days_available} Day Plan
                    </span>
                    <span>•</span>
                    <span>{item.kit.questions.length} Questions</span>
                    <span>•</span>
                    <span>{item.kit.flashcards.length} Flashcards</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
