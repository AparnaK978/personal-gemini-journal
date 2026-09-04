import React from 'react';
import { Sparkles, CheckCircle2, Lightbulb, Compass, RefreshCw } from 'lucide-react';
import { JournalEntry } from '../types';

interface GeminiSummarySectionProps {
  entry: JournalEntry;
  onGenerateSummary: () => void;
  isSummarizing: boolean;
}

export const GeminiSummarySection: React.FC<GeminiSummarySectionProps> = ({
  entry,
  onGenerateSummary,
  isSummarizing
}) => {
  const hasSummary = Boolean(entry.summary);

  return (
    <div className="bg-stone-50 rounded-2xl border border-stone-200/80 p-5 sm:p-6 mb-6">
      <div className="flex items-center justify-between pb-3 mb-4 border-b border-stone-200/60">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs font-semibold text-stone-900">
              Gemini Cognitive Synthesis & Reflections
            </h3>
            <p className="text-[10px] text-stone-500">
              Structured summary, emotional insights, and brainstormed action items
            </p>
          </div>
        </div>

        {hasSummary && (
          <button
            onClick={onGenerateSummary}
            disabled={isSummarizing}
            className="inline-flex items-center gap-1 text-[11px] font-medium text-stone-600 hover:text-stone-900 hover:bg-stone-200/60 px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-3 h-3 ${isSummarizing ? 'animate-spin' : ''}`} />
            <span>Regenerate</span>
          </button>
        )}
      </div>

      {!hasSummary ? (
        <div className="text-center py-6 px-4">
          <p className="text-xs text-stone-600 mb-3">
            Want an AI synthesis of your reflection? Gemini can extract overarching themes, emotional tone, cognitive patterns, and gentle action items.
          </p>
          <button
            onClick={onGenerateSummary}
            disabled={isSummarizing || !entry.content?.trim()}
            className="inline-flex items-center gap-2 px-4 py-2 bg-stone-900 hover:bg-stone-800 text-stone-100 rounded-xl text-xs font-medium transition-all shadow-xs cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Sparkles className={`w-3.5 h-3.5 text-amber-200 ${isSummarizing ? 'animate-spin' : ''}`} />
            <span>{isSummarizing ? 'Synthesizing...' : 'Generate Gemini Summary'}</span>
          </button>
        </div>
      ) : (
        <div className="space-y-4 text-left">
          {/* Summary Box */}
          <div className="bg-white rounded-xl p-4 border border-stone-200/70 shadow-xs">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-medium text-stone-400 uppercase tracking-wider">
                Core Synthesis
              </span>
              {entry.mood && (
                <span className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-stone-100 text-stone-700">
                  Mood: {entry.mood}
                </span>
              )}
            </div>
            <p className="text-xs text-stone-800 leading-relaxed">
              {entry.summary}
            </p>
          </div>

          {/* Grid of Insights & Action Items */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Insights */}
            {entry.insights && entry.insights.length > 0 && (
              <div className="bg-white rounded-xl p-4 border border-stone-200/70 shadow-xs">
                <div className="flex items-center gap-1.5 text-[11px] font-medium text-indigo-900 mb-2">
                  <Lightbulb className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Cognitive Insights</span>
                </div>
                <ul className="space-y-2">
                  {entry.insights.map((insight, idx) => (
                    <li key={idx} className="text-xs text-stone-700 flex items-start gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 mt-1.5 flex-shrink-0" />
                      <span>{insight}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Action Items */}
            {entry.actionItems && entry.actionItems.length > 0 && (
              <div className="bg-white rounded-xl p-4 border border-stone-200/70 shadow-xs">
                <div className="flex items-center gap-1.5 text-[11px] font-medium text-emerald-900 mb-2">
                  <Compass className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Brainstormed Actions & Reflections</span>
                </div>
                <ul className="space-y-2">
                  {entry.actionItems.map((item, idx) => (
                    <li key={idx} className="text-xs text-stone-700 flex items-start gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 mt-0.5 flex-shrink-0" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
