'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { Kit, Question, Flashcard, Requirement } from '@/core/types';
import {
  Sparkles,
  Layers,
  Calendar,
  CheckCircle2,
  HelpCircle,
  Pin,
  RefreshCw,
  Plus,
  Trash2,
  Edit3,
  BookOpen,
  Mic,
  Printer,
  ChevronLeft,
  ChevronRight,
  RotateCw,
  Award,
  ExternalLink,
  ShieldCheck,
  Zap,
  ArrowUpDown,
  Filter,
  Flame,
  Check,
  Sliders,
  Send,
  Loader2
} from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

export default function KitDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { token } = useAuth();
  const kitId = params.id as string;

  const [kit, setKit] = useState<Kit | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'builder' | 'practice' | 'mock' | 'schedule'>('builder');
  const [activeCategory, setActiveCategory] = useState<'technical' | 'system-design' | 'behavioural' | 'company-fit'>('technical');

  // Section regeneration loading states
  const [regeneratingSection, setRegeneratingSection] = useState<string | null>(null);

  // New item modals
  const [showAddQuestionModal, setShowAddQuestionModal] = useState(false);
  const [newQuestionCategory, setNewQuestionCategory] = useState<'technical' | 'system-design' | 'behavioural' | 'company-fit'>('technical');
  const [newQuestionPrompt, setNewQuestionPrompt] = useState('');
  const [newQuestionOutline, setNewQuestionOutline] = useState('');
  const [newQuestionDifficulty, setNewQuestionDifficulty] = useState(2);
  const [newQuestionReqId, setNewQuestionReqId] = useState('');

  // Practice Mode state
  const [flashcardIndex, setFlashcardIndex] = useState(0);
  const [isCardFlipped, setIsCardFlipped] = useState(false);
  const [practiceQueue, setPracticeQueue] = useState<Flashcard[]>([]);

  // Mock Interview state
  const [mockSelectedQuestionId, setMockSelectedQuestionId] = useState<string>('');
  const [mockCandidateAnswer, setMockCandidateAnswer] = useState('');
  const [mockEvaluating, setMockEvaluating] = useState(false);
  const [mockFeedback, setMockFeedback] = useState<any | null>(null);

  useEffect(() => {
    if (token && kitId) {
      loadKit();
    }
  }, [token, kitId]);

  const loadKit = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/kits/${kitId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const record = await res.json();
        setKit(record.kit);
        setPracticeQueue(record.kit.flashcards || []);
        if (record.kit.questions.length > 0) {
          setMockSelectedQuestionId(record.kit.questions[0].id);
        }
      } else {
        router.push('/');
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const saveKitChanges = async (updatedKit: Kit) => {
    setKit(updatedKit);
    setSaving(true);
    try {
      await fetch(`${API_BASE}/kits/${kitId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ kit: updatedKit }),
      });
    } catch (err) {
      console.error('Failed to save kit changes', err);
    } finally {
      setSaving(false);
    }
  };

  // ---------------- Builder Helpers ----------------

  const handleUpdateBrief = (field: 'summary' | 'what_they_do', val: string) => {
    if (!kit) return;
    const updated = {
      ...kit,
      company_brief: { ...kit.company_brief, [field]: val },
    };
    saveKitChanges(updated);
  };

  const handleTogglePinQuestion = (qId: string) => {
    if (!kit) return;
    const updatedQuestions = kit.questions.map((q) =>
      q.id === qId ? { ...q, is_pinned: !q.is_pinned } : q
    );
    saveKitChanges({ ...kit, questions: updatedQuestions });
  };

  const handleEditQuestion = (qId: string, field: 'prompt' | 'answer_outline' | 'difficulty' | 'category', val: any) => {
    if (!kit) return;
    const updatedQuestions = kit.questions.map((q) =>
      q.id === qId ? { ...q, [field]: val, is_edited: true } : q
    );
    saveKitChanges({ ...kit, questions: updatedQuestions });
  };

  const handleDeleteQuestion = (qId: string) => {
    if (!kit) return;
    const updatedQuestions = kit.questions.filter((q) => q.id !== qId);
    saveKitChanges({ ...kit, questions: updatedQuestions });
  };

  const handleAddCustomQuestion = (e: React.FormEvent) => {
    e.preventDefault();
    if (!kit || !newQuestionPrompt) return;

    const newQ: Question = {
      id: `q${kit.questions.length + 1}_custom`,
      requirement_ids: newQuestionReqId ? [newQuestionReqId] : [kit.role.requirements[0]?.id || 'r1'],
      category: newQuestionCategory,
      prompt: newQuestionPrompt,
      answer_outline: newQuestionOutline || 'Key technical and operational points.',
      difficulty: newQuestionDifficulty,
      is_custom: true,
      is_pinned: true,
    };

    const updated = {
      ...kit,
      questions: [...kit.questions, newQ],
    };

    saveKitChanges(updated);
    setShowAddQuestionModal(false);
    setNewQuestionPrompt('');
    setNewQuestionOutline('');
  };

  const handleRegenerateSection = async (section: 'brief' | 'schedule' | 'technical' | 'behavioural' | 'system-design' | 'company-fit') => {
    setRegeneratingSection(section);
    try {
      const res = await fetch(`${API_BASE}/kits/${kitId}/regenerate-section`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ section }),
      });
      if (res.ok) {
        const record = await res.json();
        setKit(record.kit);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setRegeneratingSection(null);
    }
  };

  // ---------------- Practice Mode Helpers ----------------

  const handleCardConfidence = (confidence: number) => {
    if (!kit || practiceQueue.length === 0) return;
    const currentCard = practiceQueue[flashcardIndex];

    const updatedFlashcards = kit.flashcards.map((f) =>
      f.id === currentCard.id ? { ...f, confidence, last_reviewed: new Date().toISOString() } : f
    );

    saveKitChanges({ ...kit, flashcards: updatedFlashcards });

    setIsCardFlipped(false);
    if (flashcardIndex < practiceQueue.length - 1) {
      setFlashcardIndex(flashcardIndex + 1);
    } else {
      // Sort next queue by least confident (spaced-repetition priority)
      const reordered = [...updatedFlashcards].sort((a, b) => (a.confidence || 0) - (b.confidence || 0));
      setPracticeQueue(reordered);
      setFlashcardIndex(0);
    }
  };

  // ---------------- Mock Evaluation ----------------

  const handleRunMockEvaluation = async () => {
    if (!kit || !mockCandidateAnswer.trim()) return;
    const currentQ = kit.questions.find((q) => q.id === mockSelectedQuestionId);
    if (!currentQ) return;

    setMockEvaluating(true);
    setMockFeedback(null);
    try {
      const res = await fetch(`${API_BASE}/mock/evaluate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          question: currentQ.prompt,
          answerOutline: currentQ.answer_outline,
          candidateAnswer: mockCandidateAnswer,
          category: currentQ.category,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setMockFeedback(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setMockEvaluating(false);
    }
  };

  if (loading || !kit) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center">
        <div className="text-center space-y-3">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-brand-400" />
          <p className="text-sm text-slate-400">Loading interview preparation kit...</p>
        </div>
      </div>
    );
  }

  const filteredQuestions = kit.questions.filter((q) => q.category === activeCategory);
  const currentCard = practiceQueue[flashcardIndex] || kit.flashcards[0];
  const selectedMockQuestion = kit.questions.find((q) => q.id === mockSelectedQuestionId) || kit.questions[0];

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 space-y-6">
      {/* Top Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-brand-400 uppercase tracking-wider mb-1">
            <span>{kit.source.company || 'Target Company'}</span>
            <span>•</span>
            <span className="text-slate-400 font-normal">{kit.source.location}</span>
            {kit.source.company_url && (
              <a
                href={kit.source.company_url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-slate-500 hover:text-slate-300"
              >
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white flex items-center gap-3">
            <span>{kit.role.title}</span>
            <span className="text-xs font-medium px-2.5 py-1 rounded-full border border-slate-700 bg-slate-800 text-slate-300">
              {kit.role.seniority}
            </span>
          </h1>
        </div>

        {/* Action Controls & Navigation Tabs */}
        <div className="flex flex-wrap items-center gap-3">
          {saving && (
            <span className="text-xs text-brand-400 flex items-center gap-1">
              <Check className="h-3.5 w-3.5 animate-pulse" /> Saved
            </span>
          )}

          <div className="flex bg-slate-900 border border-slate-800 rounded-xl p-1 gap-1 text-xs font-medium">
            <button
              onClick={() => setActiveTab('builder')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
                activeTab === 'builder' ? 'bg-brand-500 text-dark-950 font-bold shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Edit3 className="h-3.5 w-3.5" />
              <span>Builder</span>
            </button>

            <button
              onClick={() => setActiveTab('schedule')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
                activeTab === 'schedule' ? 'bg-brand-500 text-dark-950 font-bold shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Calendar className="h-3.5 w-3.5" />
              <span>{kit.schedule.days_available}d Plan</span>
            </button>

            <button
              onClick={() => setActiveTab('practice')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
                activeTab === 'practice' ? 'bg-brand-500 text-dark-950 font-bold shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Zap className="h-3.5 w-3.5" />
              <span>Practice ({kit.flashcards.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('mock')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
                activeTab === 'mock' ? 'bg-gradient-to-r from-emerald-400 to-teal-400 text-dark-950 font-bold shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>AI Mock Studio</span>
            </button>
          </div>

          <button
            onClick={() => window.print()}
            title="Export / Print One-Pager"
            className="rounded-xl border border-slate-700 bg-slate-800 p-2 text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
          >
            <Printer className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* ================= TAB 1: THE BUILDER ================= */}
      {activeTab === 'builder' && (
        <div className="space-y-6">
          {/* Company Brief & Role Summary Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Company Brief Card */}
            <div className="lg:col-span-2 rounded-2xl border border-slate-800 bg-slate-900/80 p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <BookOpen className="h-4 w-4 text-brand-400" />
                  <span>Company Intelligence & Brief</span>
                </h3>
                <button
                  onClick={() => handleRegenerateSection('brief')}
                  disabled={regeneratingSection === 'brief'}
                  className="flex items-center gap-1.5 text-xs text-brand-400 hover:text-brand-300 disabled:opacity-50"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${regeneratingSection === 'brief' ? 'animate-spin' : ''}`} />
                  <span>Regenerate Brief</span>
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">What They Do</label>
                  <p
                    contentEditable
                    suppressContentEditableWarning
                    onBlur={(e) => handleUpdateBrief('what_they_do', e.currentTarget.textContent || '')}
                    className="mt-1 text-xs text-slate-200 leading-relaxed bg-slate-950/40 p-2.5 rounded-lg border border-slate-800/80 focus:border-brand-500 focus:outline-none"
                  >
                    {kit.company_brief.what_they_do}
                  </p>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Strategic Synthesis</label>
                  <p
                    contentEditable
                    suppressContentEditableWarning
                    onBlur={(e) => handleUpdateBrief('summary', e.currentTarget.textContent || '')}
                    className="mt-1 text-xs text-slate-300 leading-relaxed bg-slate-950/40 p-2.5 rounded-lg border border-slate-800/80 focus:border-brand-500 focus:outline-none"
                  >
                    {kit.company_brief.summary}
                  </p>
                </div>

                {kit.company_brief.sources?.length > 0 && (
                  <div className="flex items-center gap-2 pt-1 text-[10px] text-slate-500">
                    <span>Verified sources:</span>
                    <div className="flex flex-wrap gap-1.5">
                      {kit.company_brief.sources.map((s, i) => (
                        <a key={i} href={s} target="_blank" rel="noreferrer" className="text-brand-400 hover:underline truncate max-w-[200px]">
                          {s}
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Role Requirements Checklist */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-brand-400" />
                  <span>Requirements & Audit</span>
                </h3>
                <span className="text-xs font-semibold px-2 py-0.5 rounded bg-brand-500/10 text-brand-400 border border-brand-500/20">
                  {kit.coverage.passes} Pass{kit.coverage.passes > 1 ? 'es' : ''} Checked
                </span>
              </div>

              <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                {kit.role.requirements.map((req) => (
                  <div
                    key={req.id}
                    className="rounded-lg border border-slate-800 bg-slate-950/50 p-2.5 text-xs flex items-start gap-2 justify-between"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-[10px] text-slate-400 font-bold">{req.id}</span>
                        <span
                          className={`rounded px-1.5 py-0.2 text-[9px] font-bold uppercase ${
                            req.priority === 'must' ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'bg-slate-700 text-slate-300'
                          }`}
                        >
                          {req.priority}
                        </span>
                        <span className="rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 px-1.5 text-[9px] uppercase">
                          {req.kind}
                        </span>
                      </div>
                      <p className="text-slate-300 text-[11px] leading-snug">{req.text}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Categorized Question Bank Builder */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
              <div className="flex flex-wrap items-center gap-2">
                {(['technical', 'system-design', 'behavioural', 'company-fit'] as const).map((cat) => {
                  const count = kit.questions.filter((q) => q.category === cat).length;
                  return (
                    <button
                      key={cat}
                      onClick={() => setActiveCategory(cat)}
                      className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold uppercase tracking-wider transition-all ${
                        activeCategory === cat
                          ? 'bg-brand-500 text-dark-950 shadow-md shadow-brand-500/20 font-bold'
                          : 'bg-slate-800/80 text-slate-400 hover:text-white hover:bg-slate-800'
                      }`}
                    >
                      <span>{cat.replace('-', ' ')}</span>
                      <span className={`rounded-full px-1.5 py-0.2 text-[10px] ${activeCategory === cat ? 'bg-dark-950 text-brand-400' : 'bg-slate-700 text-slate-300'}`}>
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center gap-2.5">
                <button
                  onClick={() => {
                    setNewQuestionCategory(activeCategory);
                    setShowAddQuestionModal(true);
                  }}
                  className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-700 hover:text-white transition-colors"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Add Question</span>
                </button>

                <button
                  onClick={() => handleRegenerateSection(activeCategory)}
                  disabled={regeneratingSection === activeCategory}
                  title="Regenerate this category while strictly preserving your pinned and edited questions"
                  className="flex items-center gap-1.5 rounded-lg bg-brand-500/10 border border-brand-500/30 px-3 py-1.5 text-xs font-semibold text-brand-400 hover:bg-brand-500/20 transition-all disabled:opacity-50"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${regeneratingSection === activeCategory ? 'animate-spin' : ''}`} />
                  <span>Regenerate Category</span>
                </button>
              </div>
            </div>

            {/* Questions List */}
            <div className="space-y-4">
              {filteredQuestions.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-400">
                  No questions currently in this category. Click &quot;Add Question&quot; or &quot;Regenerate Category&quot;.
                </div>
              ) : (
                filteredQuestions.map((q, idx) => (
                  <div
                    key={q.id}
                    className={`group relative rounded-xl border p-4 sm:p-5 transition-all ${
                      q.is_pinned
                        ? 'border-brand-500/50 bg-slate-900 shadow-md shadow-brand-500/5'
                        : 'border-slate-800 bg-slate-950/60 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs font-bold text-slate-400">{q.id}</span>

                        {/* Difficulty Indicator */}
                        <div className="flex items-center gap-1 bg-slate-800/80 px-2 py-0.5 rounded text-[10px] text-slate-300">
                          <span>Diff:</span>
                          <span className="font-bold text-brand-400">{q.difficulty}/3</span>
                        </div>

                        {/* Requirement mapping tags */}
                        {q.requirement_ids.map((rId) => (
                          <span key={rId} className="rounded bg-brand-500/10 border border-brand-500/20 px-1.5 py-0.5 text-[10px] font-mono text-brand-400 font-semibold">
                            Maps: {rId}
                          </span>
                        ))}

                        {q.is_edited && (
                          <span className="rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 px-1.5 py-0.5 text-[10px]">
                            Edited
                          </span>
                        )}

                        {q.is_custom && (
                          <span className="rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-1.5 py-0.5 text-[10px]">
                            Custom
                          </span>
                        )}
                      </div>

                      {/* Item Actions */}
                      <div className="flex items-center gap-1.5">
                        {/* Move Category Selector */}
                        <select
                          value={q.category}
                          onChange={(e) => handleEditQuestion(q.id, 'category', e.target.value)}
                          className="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-[11px] text-slate-300 focus:outline-none"
                        >
                          <option value="technical">Technical</option>
                          <option value="system-design">System Design</option>
                          <option value="behavioural">Behavioural</option>
                          <option value="company-fit">Company Fit</option>
                        </select>

                        {/* Pin Button */}
                        <button
                          onClick={() => handleTogglePinQuestion(q.id)}
                          title={q.is_pinned ? 'Pinned (Protected from regeneration)' : 'Pin question'}
                          className={`rounded p-1.5 transition-colors ${
                            q.is_pinned ? 'text-brand-400 bg-brand-500/10' : 'text-slate-500 hover:text-slate-300'
                          }`}
                        >
                          <Pin className="h-4 w-4" />
                        </button>

                        {/* Delete Button */}
                        <button
                          onClick={() => handleDeleteQuestion(q.id)}
                          title="Delete question"
                          className="rounded p-1.5 text-slate-500 hover:text-red-400 transition-colors"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    {/* Inline Editable Prompt */}
                    <div className="mt-3">
                      <div
                        contentEditable
                        suppressContentEditableWarning
                        onBlur={(e) => handleEditQuestion(q.id, 'prompt', e.currentTarget.textContent || '')}
                        className="text-sm sm:text-base font-semibold text-white focus:bg-slate-800/80 p-1.5 rounded focus:outline-none focus:ring-1 focus:ring-brand-500 leading-snug"
                      >
                        {q.prompt}
                      </div>
                    </div>

                    {/* Inline Editable Answer Outline */}
                    <div className="mt-3 rounded-lg border border-slate-800 bg-slate-900/50 p-3">
                      <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                        Expected Answer Blueprint &amp; Key Signals
                      </div>
                      <div
                        contentEditable
                        suppressContentEditableWarning
                        onBlur={(e) => handleEditQuestion(q.id, 'answer_outline', e.currentTarget.textContent || '')}
                        className="text-xs text-slate-300 focus:bg-slate-800 p-1.5 rounded focus:outline-none focus:ring-1 focus:ring-brand-500 leading-relaxed"
                      >
                        {q.answer_outline}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ================= TAB 2: SCHEDULE VIEW ================= */}
      {activeTab === 'schedule' && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Calendar className="h-5 w-5 text-brand-400" />
                <span>Deterministic {kit.schedule.days_available}-Day Master Preparation Plan</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Arithmetic load allocation placing harder &amp; must-have requirements earlier with exact integer minutes.
              </p>
            </div>

            <button
              onClick={() => handleRegenerateSection('schedule')}
              disabled={regeneratingSection === 'schedule'}
              className="flex items-center gap-1.5 rounded-lg border border-brand-500/30 bg-brand-500/10 px-3.5 py-2 text-xs font-semibold text-brand-400 hover:bg-brand-500/20 disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${regeneratingSection === 'schedule' ? 'animate-spin' : ''}`} />
              <span>Re-allocate Schedule</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {kit.schedule.days.map((dayItem) => {
              const dayQuestions = kit.questions.filter((q) => dayItem.question_ids.includes(q.id));
              return (
                <div
                  key={dayItem.day}
                  className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 space-y-3 relative hover:border-brand-500/30 transition-colors"
                >
                  <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                    <span className="text-xs font-bold text-brand-400 uppercase tracking-wider">
                      Day {dayItem.day}
                    </span>
                    <span className="text-[11px] font-semibold text-slate-400 bg-slate-800 px-2 py-0.5 rounded">
                      {dayItem.minutes} mins
                    </span>
                  </div>

                  <h4 className="text-sm font-bold text-white leading-tight">
                    {dayItem.focus}
                  </h4>

                  <div className="space-y-1.5 pt-1">
                    <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">
                      Target Questions ({dayQuestions.length}):
                    </div>
                    {dayQuestions.length === 0 ? (
                      <div className="text-xs text-slate-500 italic">Review &amp; flashcard practice session</div>
                    ) : (
                      dayQuestions.map((dq) => (
                        <div key={dq.id} className="rounded bg-slate-900 p-2 text-xs text-slate-300 border border-slate-800/60 flex items-start gap-1.5">
                          <span className="font-mono text-[10px] text-brand-400 font-bold shrink-0">{dq.id}</span>
                          <span className="line-clamp-2 leading-tight">{dq.prompt}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ================= TAB 3: PRACTICE MODE ================= */}
      {activeTab === 'practice' && (
        <div className="max-w-2xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <Zap className="h-5 w-5 text-brand-400" />
                <span>Spaced Repetition Practice</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Card {flashcardIndex + 1} of {practiceQueue.length} • Prioritized by confidence queue
              </p>
            </div>

            <button
              onClick={() => {
                const reordered = [...kit.flashcards].sort((a, b) => (a.confidence || 0) - (b.confidence || 0));
                setPracticeQueue(reordered);
                setFlashcardIndex(0);
                setIsCardFlipped(false);
              }}
              className="text-xs text-brand-400 hover:underline flex items-center gap-1"
            >
              <RotateCw className="h-3 w-3" /> Reset / Shuffle
            </button>
          </div>

          {/* 3D Flip Card Container */}
          <div
            onClick={() => setIsCardFlipped(!isCardFlipped)}
            className="cursor-pointer min-h-[300px] rounded-2xl border border-slate-700 bg-gradient-to-br from-slate-900 to-slate-950 p-8 shadow-2xl flex flex-col justify-between hover:border-brand-500/50 transition-all select-none"
          >
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span className="font-mono font-bold text-brand-400">{currentCard?.id || 'f1'}</span>
              <span className="bg-slate-800 px-2 py-0.5 rounded text-[11px]">
                {isCardFlipped ? 'Answer View' : 'Question Prompt (Click to reveal answer)'}
              </span>
            </div>

            <div className="py-6 text-center">
              {!isCardFlipped ? (
                <h3 className="text-lg sm:text-xl font-bold text-white leading-relaxed">
                  {currentCard?.front}
                </h3>
              ) : (
                <div className="text-sm sm:text-base text-slate-200 leading-relaxed font-medium bg-slate-950/60 p-4 rounded-xl border border-slate-800">
                  {currentCard?.back}
                </div>
              )}
            </div>

            <div className="text-center text-[11px] text-slate-500">
              Click anywhere to flip card
            </div>
          </div>

          {/* Confidence Rating Controls */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-2 text-center">
            <div className="text-xs text-slate-400 font-semibold uppercase tracking-wider">
              Rate your recall confidence
            </div>
            <div className="flex justify-center gap-3">
              <button
                onClick={() => handleCardConfidence(1)}
                className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-xs font-bold text-red-300 hover:bg-red-500/20 active:scale-95 transition-all"
              >
                1 • Struggled
              </button>
              <button
                onClick={() => handleCardConfidence(3)}
                className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-xs font-bold text-amber-300 hover:bg-amber-500/20 active:scale-95 transition-all"
              >
                3 • Moderate
              </button>
              <button
                onClick={() => handleCardConfidence(5)}
                className="rounded-lg border border-brand-500/30 bg-brand-500/10 px-4 py-2 text-xs font-bold text-brand-400 hover:bg-brand-500/20 active:scale-95 transition-all"
              >
                5 • Mastered
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= TAB 4: CREATIVE FEATURE - AI MOCK INTERVIEW STUDIO ================= */}
      {activeTab === 'mock' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Question Selector & Prompt */}
          <div className="lg:col-span-6 rounded-2xl border border-slate-800 bg-slate-900/80 p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-emerald-400" />
                <span>Live Interview Simulation</span>
              </h3>
              <select
                value={mockSelectedQuestionId}
                onChange={(e) => {
                  setMockSelectedQuestionId(e.target.value);
                  setMockFeedback(null);
                }}
                className="bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-slate-200 focus:outline-none"
              >
                {kit.questions.map((q) => (
                  <option key={q.id} value={q.id}>
                    [{q.category}] {q.prompt.slice(0, 40)}...
                  </option>
                ))}
              </select>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 space-y-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-brand-400">
                Current Question ({selectedMockQuestion.category})
              </span>
              <p className="text-sm sm:text-base font-bold text-white">
                {selectedMockQuestion.prompt}
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                Your Answer / Response
              </label>
              <textarea
                rows={8}
                value={mockCandidateAnswer}
                onChange={(e) => setMockCandidateAnswer(e.target.value)}
                placeholder="Type your structured answer here (use STAR framework for behavioural, architecture & trade-offs for technical/system design)..."
                className="w-full rounded-xl border border-slate-700 bg-slate-950/60 p-3.5 text-sm text-slate-100 placeholder-slate-500 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 resize-y"
              />
            </div>

            <button
              onClick={handleRunMockEvaluation}
              disabled={mockEvaluating || !mockCandidateAnswer.trim()}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 py-3 text-sm font-bold text-dark-950 hover:from-emerald-400 hover:to-teal-400 disabled:opacity-50 transition-all shadow-lg shadow-emerald-500/20"
            >
              {mockEvaluating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Evaluating Answer with AI Rubric...</span>
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  <span>Submit for AI Evaluation</span>
                </>
              )}
            </button>
          </div>

          {/* Feedback & Score Panel */}
          <div className="lg:col-span-6 rounded-2xl border border-slate-800 bg-slate-900/80 p-6 space-y-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2 border-b border-slate-800 pb-3">
              <Award className="h-4 w-4 text-brand-400" />
              <span>AI Evaluation &amp; Rubric Feedback</span>
            </h3>

            {!mockFeedback ? (
              <div className="py-16 text-center text-xs text-slate-500">
                Submit an answer on the left to receive immediate scoring and targeted coaching feedback.
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
                  <span className="text-sm font-bold text-slate-200">Overall Interview Readiness</span>
                  <span className="text-2xl font-black text-emerald-400">{mockFeedback.score}/100</span>
                </div>

                <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-4">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
                    Hiring Manager Feedback
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">{mockFeedback.feedback}</p>
                </div>

                {mockFeedback.strengths?.length > 0 && (
                  <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-4 space-y-1.5">
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-brand-400">
                      Key Strengths Demonstrated
                    </div>
                    {mockFeedback.strengths.map((str: string, i: number) => (
                      <div key={i} className="text-xs text-slate-300 flex items-start gap-1.5">
                        <CheckCircle2 className="h-3.5 w-3.5 text-brand-400 shrink-0 mt-0.5" />
                        <span>{str}</span>
                      </div>
                    ))}
                  </div>
                )}

                {mockFeedback.improvements?.length > 0 && (
                  <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-4 space-y-1.5">
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-amber-400">
                      High-Yield Improvement Opportunities
                    </div>
                    {mockFeedback.improvements.map((imp: string, i: number) => (
                      <div key={i} className="text-xs text-slate-300 flex items-start gap-1.5">
                        <Flame className="h-3.5 w-3.5 text-amber-400 shrink-0 mt-0.5" />
                        <span>{imp}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Add Custom Question Modal */}
      {showAddQuestionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="relative w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-white">Add Custom Interview Question</h3>
            <p className="mt-1 text-xs text-slate-400">
              Custom questions are automatically pinned and preserved across regenerations.
            </p>

            <form onSubmit={handleAddCustomQuestion} className="mt-4 space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Category</label>
                <select
                  value={newQuestionCategory}
                  onChange={(e: any) => setNewQuestionCategory(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs text-white focus:outline-none"
                >
                  <option value="technical">Technical</option>
                  <option value="system-design">System Design</option>
                  <option value="behavioural">Behavioural</option>
                  <option value="company-fit">Company Fit</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Question Prompt</label>
                <textarea
                  required
                  rows={3}
                  value={newQuestionPrompt}
                  onChange={(e) => setNewQuestionPrompt(e.target.value)}
                  placeholder="Enter the question prompt..."
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 p-2.5 text-xs text-white placeholder-slate-500 focus:border-brand-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Answer Blueprint Outline</label>
                <textarea
                  rows={3}
                  value={newQuestionOutline}
                  onChange={(e) => setNewQuestionOutline(e.target.value)}
                  placeholder="Key concepts, architecture trade-offs, or STAR checkpoints..."
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 p-2.5 text-xs text-white placeholder-slate-500 focus:border-brand-500 focus:outline-none"
                />
              </div>

              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Difficulty (1-3)</label>
                  <select
                    value={newQuestionDifficulty}
                    onChange={(e) => setNewQuestionDifficulty(Number(e.target.value))}
                    className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs text-white focus:outline-none"
                  >
                    <option value={1}>1 - Fundamental</option>
                    <option value={2}>2 - Senior / Applied</option>
                    <option value={3}>3 - Staff / Complex</option>
                  </select>
                </div>

                <div className="flex-1">
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Maps to Requirement</label>
                  <select
                    value={newQuestionReqId}
                    onChange={(e) => setNewQuestionReqId(e.target.value)}
                    className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs text-white focus:outline-none"
                  >
                    {kit.role.requirements.map((r) => (
                      <option key={r.id} value={r.id}>
                        [{r.id}] {r.text.slice(0, 25)}...
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="mt-5 flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddQuestionModal(false)}
                  className="rounded-lg px-4 py-2 text-xs text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-brand-500 px-4 py-2 text-xs font-bold text-dark-950 hover:bg-brand-400 transition-all"
                >
                  Add to Kit
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
