import React from 'react';
import { Sparkles, Shield, Lock, MessageSquare, Database, ArrowRight } from 'lucide-react';

interface LandingPageProps {
  onSignIn: () => void;
  isLoading: boolean;
  error: string | null;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onSignIn, isLoading, error }) => {
  return (
    <div className="min-h-[calc(100vh-4rem)] bg-stone-100 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto w-full">
        {/* Main Card */}
        <div className="bg-white rounded-3xl border border-stone-200/80 p-8 sm:p-12 shadow-sm relative overflow-hidden">
          {/* Subtle Top Accent */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-400 via-stone-800 to-amber-400 opacity-60" />

          <div className="text-center max-w-xl mx-auto">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-stone-100 border border-stone-200 text-stone-700 text-xs font-medium mb-6">
              <Sparkles className="w-3.5 h-3.5 text-amber-600" />
              <span>Multi-Turn Reflections Powered by Gemini</span>
            </div>

            <h1 className="text-3xl sm:text-4xl font-semibold text-stone-900 tracking-tight mb-4">
              Your Private Space to Think, Reflect, and Converse
            </h1>

            <p className="text-stone-600 text-base sm:text-lg leading-relaxed mb-8">
              Write journal entries, engage in deep multi-turn discussions with Gemini to untangle thoughts, and receive structured cognitive reflections—stored strictly in your private database.
            </p>

            {error && (
              <div className="mb-6 p-4 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-sm text-left">
                <p className="font-medium">Authentication notice</p>
                <p className="text-xs mt-1 text-red-600">{error}</p>
              </div>
            )}

            {/* Google Sign-In Button */}
            <div className="flex flex-col items-center justify-center gap-3">
              <button
                onClick={onSignIn}
                disabled={isLoading}
                className="w-full sm:w-auto min-w-[240px] inline-flex items-center justify-center gap-3 px-6 py-3.5 bg-stone-900 hover:bg-stone-800 text-stone-100 rounded-2xl font-medium text-sm transition-all shadow-sm hover:shadow active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                {isLoading ? (
                  <div className="w-5 h-5 border-2 border-stone-400 border-t-white rounded-full animate-spin" />
                ) : (
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path
                      fill="#EA4335"
                      d="M12 5c1.6 0 3 .6 4.1 1.6l3.1-3.1C17.3 1.7 14.8 1 12 1 7.4 1 3.5 3.6 1.6 7.3l3.7 2.9C6.2 7.3 8.9 5 12 5z"
                    />
                    <path
                      fill="#4285F4"
                      d="M23.5 12.3c0-.8-.1-1.7-.2-2.3H12v4.6h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.9z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.3 14.8c-.2-.7-.4-1.5-.4-2.3 0-.8.2-1.6.4-2.3L1.6 7.3C.6 9.3 0 10.6 0 12c0 1.4.6 2.7 1.6 4.7l3.7-2.9z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3.1 0-5.8-2.3-6.7-5.2L1.6 16C3.5 19.7 7.4 23 12 23z"
                    />
                  </svg>
                )}
                <span>{isLoading ? 'Signing In...' : 'Sign in with Google'}</span>
                {!isLoading && <ArrowRight className="w-4 h-4 text-stone-400" />}
              </button>
              <span className="text-[11px] text-stone-600">
                Direct authentication via Firebase. We never see or store your Google password.
              </span>
            </div>
          </div>

          {/* Core Guarantees & Features */}
          <div className="mt-12 pt-8 border-t border-stone-100 grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
            <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200/50">
              <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center mb-3">
                <Shield className="w-4 h-4" />
              </div>
              <h2 className="text-sm font-semibold text-stone-900 mb-1">User Data Isolation</h2>
              <p className="text-xs text-stone-600 leading-relaxed">
                Cloud Firestore rules strictly enforce owner-only access. Your journals are isolated to your UID.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200/50">
              <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-800 flex items-center justify-center mb-3">
                <MessageSquare className="w-4 h-4" />
              </div>
              <h2 className="text-sm font-semibold text-stone-900 mb-1">Multi-Turn Discussion</h2>
              <p className="text-xs text-stone-600 leading-relaxed">
                Converse continuously with Gemini to explore thoughts, brainstorm action steps, and reframe challenges.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200/50">
              <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center mb-3">
                <Lock className="w-4 h-4" />
              </div>
              <h2 className="text-sm font-semibold text-stone-900 mb-1">Server-Side Security</h2>
              <p className="text-xs text-stone-600 leading-relaxed">
                Gemini API calls are securely proxied on Cloud Run with zero client key exposure.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
