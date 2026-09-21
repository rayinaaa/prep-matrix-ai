'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '../context/AuthContext';
import { Sparkles, Terminal, LogOut, User as UserIcon, LogIn, Key, BookOpen, Layers } from 'lucide-react';

export function Navbar() {
  const { user, logout, login, register } = useAuth();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [authError, setAuthError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setLoading(true);
    try {
      if (isRegisterMode) {
        await register(email, password, name);
      } else {
        await login(email, password);
      }
      setShowAuthModal(false);
      setEmail('');
      setPassword('');
    } catch (err: any) {
      setAuthError(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <header className="sticky top-0 z-50 w-full border-b border-slate-800 bg-dark-950/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-brand-600 to-emerald-400 text-dark-950 font-black text-xl shadow-lg shadow-brand-500/20 group-hover:scale-105 transition-transform">
              T
            </div>
            <div>
              <div className="flex items-center gap-1.5 font-bold tracking-tight text-slate-100 text-lg">
                <span>Trao</span>
                <span className="text-brand-400 font-normal">PrepKit</span>
                <span className="rounded bg-brand-500/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-brand-400 border border-brand-500/20">
                  AI v2.0
                </span>
              </div>
              <p className="text-[11px] text-slate-400 hidden sm:block">Autonomous Interview Research & Strategy Engine</p>
            </div>
          </Link>

          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium text-slate-300 hover:bg-slate-800/80 hover:text-white transition-colors"
            >
              <Layers className="h-4 w-4 text-brand-400" />
              <span>Kits</span>
            </Link>

            {user ? (
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 rounded-full border border-slate-800 bg-slate-900/60 px-3 py-1 text-xs text-slate-300">
                  <UserIcon className="h-3.5 w-3.5 text-brand-400" />
                  <span className="max-w-[120px] truncate font-medium">{user.name || user.email}</span>
                </div>
                <button
                  onClick={logout}
                  title="Log out"
                  className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-red-400 transition-colors"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => {
                  setIsRegisterMode(false);
                  setShowAuthModal(true);
                }}
                className="flex items-center gap-2 rounded-lg bg-brand-500 px-3.5 py-1.5 text-sm font-semibold text-dark-950 hover:bg-brand-400 shadow-md shadow-brand-500/20 transition-all active:scale-95"
              >
                <LogIn className="h-4 w-4" />
                <span>Sign In</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Auth Modal */}
      {showAuthModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="relative w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">
            <h3 className="text-xl font-bold text-white">
              {isRegisterMode ? 'Create an Account' : 'Welcome Back'}
            </h3>
            <p className="mt-1 text-xs text-slate-400">
              {isRegisterMode
                ? 'Create a profile to generate, customize and save your interview kits.'
                : 'Sign in to access your interview preparation kits and study progress.'}
            </p>

            {authError && (
              <div className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 p-2.5 text-xs text-red-300">
                {authError}
              </div>
            )}

            <form onSubmit={handleAuthSubmit} className="mt-4 space-y-3.5">
              {isRegisterMode && (
                <div>
                  <label className="block text-xs font-medium text-slate-300">Your Name</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Jane Doe"
                    className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-300">Email Address</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="candidate@example.com"
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300">Password</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="mt-2 w-full rounded-lg bg-brand-500 py-2.5 text-sm font-semibold text-dark-950 hover:bg-brand-400 disabled:opacity-50 transition-all"
              >
                {loading ? 'Processing...' : isRegisterMode ? 'Sign Up' : 'Sign In'}
              </button>
            </form>

            <div className="mt-4 flex items-center justify-between text-xs text-slate-400">
              <button
                onClick={() => {
                  setIsRegisterMode(!isRegisterMode);
                  setAuthError('');
                }}
                className="text-brand-400 hover:underline"
              >
                {isRegisterMode ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}
              </button>
              <button
                onClick={() => setShowAuthModal(false)}
                className="text-slate-400 hover:text-white"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
