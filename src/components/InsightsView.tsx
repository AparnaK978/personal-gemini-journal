import React from 'react';
import {
  Sparkles,
  RefreshCw,
  TrendingUp,
  Award,
  AlertCircle,
  HelpCircle,
  Lightbulb,
  Compass,
  Calendar,
  BookOpen,
  CheckCircle2,
  ShieldCheck,
  Plus
} from 'lucide-react';
import { UserInsight, JournalEntry } from '../types';

interface InsightsViewProps {
  entries: JournalEntry[];
  latestInsight: UserInsight | null;
  allInsights: UserInsight[];
  isLoading: boolean;
  isGenerating: boolean;
  error: string | null;
  onGenerateInsights: (forceRefresh?: boolean) => void;
  onClearError: () => void;
  onStartReflectionWithPrompt?: (promptText: string) => void;
  onGoToJournal: () => void;
}

export const InsightsView: React.FC<InsightsViewProps> = ({
  entries,
  latestInsight,
  allInsights,
  isLoading,
  isGenerating,
  error,
  onGenerateInsights,
  onClearError,
  onStartReflectionWithPrompt,
  onGoToJournal
}) => {
  const hasEntries = entries.length > 0;

  const formatDate = (date: any) => {
    if (!date) return '';
    const d = date instanceof Date ? date : new Date(date);
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    }).format(d);
  };

  const getMoodColor = (mood: string) => {
    switch (mood.toLowerCase()) {
      case 'thoughtful':
        return 'bg-indigo-50 text-indigo-700 border-indigo-200/70';
      case 'grateful':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200/70';
      case 'calm':
        return 'bg-teal-50 text-teal-700 border-teal-200/70';
      case 'energized':
        return 'bg-amber-50 text-amber-800 border-amber-200/70';
      case 'challenging':
        return 'bg-rose-50 text-rose-700 border-rose-200/70';
      case 'creative':
        return 'bg-purple-50 text-purple-700 border-purple-200/70';
      default:
        return 'bg-stone-100 text-stone-700 border-stone-200';
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      {/* 1. Header Bar */}
      <div className="bg-white rounded-2xl p-6 border border-stone-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-xl bg-amber-100/80 text-amber-800 flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </div>
            <h1 className="text-xl font-bold text-stone-900 tracking-tight">
              Mood & Progress Insights
            </h1>
          </div>
          <p className="text-xs text-stone-500 max-w-xl leading-relaxed">
            AI-powered cognitive reflection synthesized across your private journal history. Discover recurring themes, emotional trajectories, personal accomplishments, and gentle growth areas.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={() => onGenerateInsights(false)}
            disabled={!hasEntries || isGenerating}
            title={latestInsight ? "Checks for journal changes and updates insights (cache-aware)" : "Generate initial mood & progress insights"}
            className={`inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-medium transition-all shadow-xs cursor-pointer ${
              !hasEntries
                ? 'bg-stone-200 text-stone-400 cursor-not-allowed'
                : isGenerating
                ? 'bg-stone-800 text-stone-200 cursor-wait'
                : 'bg-stone-900 hover:bg-stone-800 text-stone-100 active:scale-[0.98]'
            }`}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isGenerating ? 'animate-spin' : ''}`} />
            <span>
              {isGenerating
                ? 'Synthesizing...'
                : latestInsight
                ? 'Refresh Insights'
                : 'Generate Insights'}
            </span>
          </button>

          {latestInsight && (
            <button
              onClick={() => onGenerateInsights(true)}
              disabled={!hasEntries || isGenerating}
              title="Force Gemini to re-analyze reflections even if no new entries were added"
              className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-medium border border-stone-300 text-stone-700 bg-white hover:bg-stone-50 hover:text-stone-900 active:scale-[0.98] transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-2xs"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-600" />
              <span>Force Re-analyze</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. Medical & Non-Diagnostic Disclaimer Banner */}
      <div className="rounded-xl p-3.5 bg-amber-50/70 border border-amber-200/60 text-amber-900 text-xs flex items-start gap-3">
        <ShieldCheck className="w-4 h-4 text-amber-700 flex-shrink-0 mt-0.5" />
        <div className="leading-relaxed">
          <span className="font-semibold text-amber-950">Reflective Observation Notice: </span>
          Insights are AI-synthesized personal observations based on your recorded thoughts and self-selected moods. They are designed for mindful self-reflection and personal inquiry, and do not constitute clinical, psychiatric, or psychological diagnosis or medical advice.
        </div>
      </div>

      {/* 3. Error State */}
      {error && (
        <div className="rounded-xl p-4 bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start justify-between gap-3 animate-in fade-in">
          <div className="flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium mb-0.5">Insight Generation Issue</p>
              <p className="text-rose-700 leading-relaxed">{error}</p>
            </div>
          </div>
          <button
            onClick={onClearError}
            className="px-2.5 py-1 text-[11px] font-medium text-rose-700 hover:bg-rose-100 rounded-lg transition-colors cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* 4. Loading / Generating State */}
      {isGenerating && (
        <div className="bg-white rounded-2xl p-8 border border-stone-200 text-center space-y-4 animate-pulse">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-700 flex items-center justify-center mx-auto">
            <RefreshCw className="w-6 h-6 animate-spin" />
          </div>
          <div className="max-w-md mx-auto space-y-2">
            <h3 className="text-sm font-semibold text-stone-900">
              Synthesizing Your Journal Reflections
            </h3>
            <p className="text-xs text-stone-500 leading-relaxed">
              Gemini is evaluating your journal entries to uncover recurring patterns, linguistic shifts, accomplishments, and thoughtful future prompts. This usually takes 3 to 6 seconds...
            </p>
          </div>
          <div className="flex justify-center gap-1.5 pt-2">
            <div className="w-2 h-2 rounded-full bg-stone-300 animate-bounce [animation-delay:-0.3s]" />
            <div className="w-2 h-2 rounded-full bg-stone-400 animate-bounce [animation-delay:-0.15s]" />
            <div className="w-2 h-2 rounded-full bg-stone-500 animate-bounce" />
          </div>
        </div>
      )}

      {/* 5. Insufficient Data State (0 journal entries) */}
      {!hasEntries && !isGenerating && (
        <div className="bg-white rounded-2xl p-8 border border-stone-200 text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-stone-100 text-stone-500 flex items-center justify-center mx-auto">
            <BookOpen className="w-6 h-6" />
          </div>
          <div className="max-w-md mx-auto space-y-1.5">
            <h3 className="text-base font-semibold text-stone-900">
              No Journal Reflections Found
            </h3>
            <p className="text-xs text-stone-500 leading-relaxed">
              AI Mood & Progress Insights require at least one journal entry in your history to identify themes, emotional trajectories, and personal wins.
            </p>
          </div>
          <button
            onClick={onGoToJournal}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-stone-900 hover:bg-stone-800 text-stone-100 rounded-xl text-xs font-medium transition-all shadow-xs cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Write Your First Reflection</span>
          </button>
        </div>
      )}

      {/* 6. Empty State (Entries exist, but no insights generated yet) */}
      {hasEntries && !latestInsight && !isGenerating && (
        <div className="bg-white rounded-2xl p-8 border border-stone-200 text-center space-y-5">
          <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-800 flex items-center justify-center mx-auto shadow-xs">
            <Sparkles className="w-7 h-7 text-amber-700" />
          </div>
          <div className="max-w-md mx-auto space-y-2">
            <h3 className="text-base font-bold text-stone-900">
              Ready to Analyze {entries.length} {entries.length === 1 ? 'Reflection' : 'Reflections'}
            </h3>
            <p className="text-xs text-stone-500 leading-relaxed">
              Unlock a holistic perspective on your mindset. Gemini will analyze your entries to surface recurring themes, emotional tone shifts, celebrated milestones, and constructive reflection opportunities.
            </p>
          </div>

          <div className="max-w-lg mx-auto grid grid-cols-1 sm:grid-cols-3 gap-3 text-left pt-2">
            <div className="p-3 rounded-xl bg-stone-50 border border-stone-200/60">
              <TrendingUp className="w-4 h-4 text-indigo-600 mb-1.5" />
              <h4 className="text-xs font-semibold text-stone-800">Mood Trajectory</h4>
              <p className="text-[11px] text-stone-500 mt-0.5">Observe emotional language and mindset patterns over time.</p>
            </div>
            <div className="p-3 rounded-xl bg-stone-50 border border-stone-200/60">
              <Award className="w-4 h-4 text-emerald-600 mb-1.5" />
              <h4 className="text-xs font-semibold text-stone-800">Wins & Progress</h4>
              <p className="text-[11px] text-stone-500 mt-0.5">Highlight accomplishments and milestones documented.</p>
            </div>
            <div className="p-3 rounded-xl bg-stone-50 border border-stone-200/60">
              <Lightbulb className="w-4 h-4 text-amber-600 mb-1.5" />
              <h4 className="text-xs font-semibold text-stone-800">Future Prompts</h4>
              <p className="text-[11px] text-stone-500 mt-0.5">Receive tailored questions for your upcoming entries.</p>
            </div>
          </div>

          <button
            onClick={() => onGenerateInsights(false)}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-stone-900 hover:bg-stone-800 text-stone-100 rounded-xl text-xs font-medium transition-all shadow-xs cursor-pointer active:scale-[0.98]"
          >
            <Sparkles className="w-4 h-4 text-amber-300" />
            <span>Generate Mood & Progress Insights</span>
          </button>
        </div>
      )}

      {/* 7. Success State: Display Comprehensive Insights */}
      {latestInsight && !isGenerating && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Metadata pill */}
          <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-xs text-stone-500">
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center gap-1.5 font-medium text-stone-700">
                <Calendar className="w-3.5 h-3.5 text-stone-400" />
                Date Range: {latestInsight.dateRange.from === latestInsight.dateRange.to ? latestInsight.dateRange.from : `${latestInsight.dateRange.from} — ${latestInsight.dateRange.to}`}
              </span>
              <span>•</span>
              <span>
                {(() => {
                  const count: number = typeof latestInsight.entryCount === 'number' && latestInsight.entryCount > 0
                    ? latestInsight.entryCount
                    : (latestInsight.moodAnalysis?.moodDistribution
                        ? Object.values(latestInsight.moodAnalysis.moodDistribution).reduce((sum: number, b: any): number => sum + (typeof b === 'number' ? b : 0), 0)
                        : entries.length);
                  return `${count} ${count === 1 ? 'reflection' : 'reflections'} evaluated`;
                })()}
              </span>
            </div>
            <span className="text-[11px] text-stone-400">
              Synthesized on {formatDate(latestInsight.generatedAt)}
            </span>
          </div>

          {/* Section A: Emotional Trajectory & Mood Distribution */}
          <div className="bg-white rounded-2xl p-6 border border-stone-200/80 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-indigo-600" />
                <h2 className="text-sm font-bold text-stone-900">
                  Mood & Emotional Trajectory
                </h2>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] text-stone-400">Primary Tone:</span>
                <span className="px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-800 text-xs font-semibold border border-indigo-200/70">
                  {latestInsight.moodAnalysis.predominantMood}
                </span>
              </div>
            </div>

            <p className="text-xs text-stone-700 leading-relaxed">
              {latestInsight.moodAnalysis.emotionalTrajectory}
            </p>

            {/* Mood Distribution Badges */}
            {latestInsight.moodAnalysis.moodDistribution && (
              <div className="pt-2">
                <p className="text-[11px] font-medium text-stone-500 mb-2">
                  Recorded Mood Frequency:
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  {Object.entries(latestInsight.moodAnalysis.moodDistribution).map(([mood, count]) => (
                    <div
                      key={mood}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border ${getMoodColor(mood)}`}
                    >
                      <span className="capitalize">{mood}</span>
                      <span className="w-4 h-4 rounded-full bg-white/70 text-[10px] flex items-center justify-center font-bold">
                        {count}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Language Observations */}
            {latestInsight.moodAnalysis.languageObservations && latestInsight.moodAnalysis.languageObservations.length > 0 && (
              <div className="pt-3 border-t border-stone-100">
                <p className="text-[11px] font-medium text-stone-500 mb-2">
                  Linguistic & Cognitive Patterns Observed:
                </p>
                <div className="space-y-1.5">
                  {latestInsight.moodAnalysis.languageObservations.map((obs, idx) => (
                    <div key={idx} className="flex items-start gap-2 text-xs text-stone-600">
                      <span className="text-stone-400 mt-1">•</span>
                      <span className="leading-relaxed">{obs}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Section B: Recurring Themes */}
          <div className="bg-white rounded-2xl p-6 border border-stone-200/80 shadow-xs space-y-4">
            <div className="flex items-center gap-2 border-b border-stone-100 pb-3">
              <Compass className="w-4 h-4 text-emerald-600" />
              <h2 className="text-sm font-bold text-stone-900">
                Recurring Core Themes
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {latestInsight.recurringThemes.map((theme, idx) => (
                <div
                  key={idx}
                  className="p-4 rounded-xl bg-stone-50/70 border border-stone-200/70 space-y-1.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-xs font-bold text-stone-900">
                      {theme.theme}
                    </h3>
                    {theme.occurrences && (
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-stone-200/70 text-stone-700">
                        {theme.occurrences} {theme.occurrences === 1 ? 'reflection' : 'reflections'}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-stone-600 leading-relaxed">
                    {theme.description}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Section C: Accomplishments & Progress vs. Challenges & Growth */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Accomplishments */}
            <div className="bg-white rounded-2xl p-6 border border-stone-200/80 shadow-xs space-y-3">
              <div className="flex items-center gap-2 border-b border-stone-100 pb-3">
                <Award className="w-4 h-4 text-amber-600" />
                <h2 className="text-sm font-bold text-stone-900">
                  Accomplishments & Milestones
                </h2>
              </div>
              <ul className="space-y-2.5">
                {latestInsight.accomplishments.map((item, idx) => (
                  <li key={idx} className="flex items-start gap-2.5 text-xs text-stone-700">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                    <span className="leading-relaxed">{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Challenges & Growth Opportunities */}
            <div className="bg-white rounded-2xl p-6 border border-stone-200/80 shadow-xs space-y-3">
              <div className="flex items-center gap-2 border-b border-stone-100 pb-3">
                <Lightbulb className="w-4 h-4 text-indigo-600" />
                <h2 className="text-sm font-bold text-stone-900">
                  Challenges & Growth Areas
                </h2>
              </div>
              <div className="space-y-3">
                {latestInsight.challenges.length > 0 && (
                  <div>
                    <p className="text-[11px] font-semibold text-stone-500 uppercase tracking-wider mb-1.5">
                      Friction Points Reflected:
                    </p>
                    <ul className="space-y-1.5">
                      {latestInsight.challenges.map((c, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-xs text-stone-600">
                          <span className="text-rose-400 mt-0.5">•</span>
                          <span className="leading-relaxed">{c}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {latestInsight.growthAreas.length > 0 && (
                  <div className="pt-2 border-t border-stone-100">
                    <p className="text-[11px] font-semibold text-stone-500 uppercase tracking-wider mb-1.5">
                      Gentle Growth Opportunities:
                    </p>
                    <ul className="space-y-1.5">
                      {latestInsight.growthAreas.map((g, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-xs text-stone-700">
                          <span className="text-indigo-400 mt-0.5">•</span>
                          <span className="leading-relaxed">{g}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Section D: Practical Reflection Prompts */}
          <div className="bg-white rounded-2xl p-6 border border-stone-200/80 shadow-xs space-y-4">
            <div className="flex items-center gap-2 border-b border-stone-100 pb-3">
              <HelpCircle className="w-4 h-4 text-teal-600" />
              <div>
                <h2 className="text-sm font-bold text-stone-900">
                  Tailored Reflection Prompts
                </h2>
                <p className="text-[11px] text-stone-400">
                  Inquiries derived from your journal patterns to guide your next writing sessions.
                </p>
              </div>
            </div>

            <div className="space-y-2.5">
              {latestInsight.reflectionPrompts.map((prompt, idx) => (
                <div
                  key={idx}
                  className="p-3.5 rounded-xl bg-stone-50/70 border border-stone-200/70 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs"
                >
                  <p className="text-stone-800 font-medium leading-relaxed italic">
                    "{prompt}"
                  </p>
                  {onStartReflectionWithPrompt && (
                    <button
                      onClick={() => onStartReflectionWithPrompt(prompt)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-stone-100 text-stone-800 rounded-lg text-[11px] font-semibold border border-stone-200 transition-colors flex-shrink-0 cursor-pointer shadow-2xs"
                    >
                      <span>Journal on this</span>
                      <Plus className="w-3 h-3" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Section E: Past Insights History Accordion/List */}
          {allInsights.length > 1 && (
            <div className="bg-white rounded-2xl p-5 border border-stone-200/80 shadow-xs">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-bold text-stone-900">
                  Insights History ({allInsights.length} syntheses)
                </h3>
                <span className="text-[11px] text-stone-400">
                  Stored securely in Firestore
                </span>
              </div>
              <div className="divide-y divide-stone-100 text-xs text-stone-600">
                {allInsights.map((ins, index) => (
                  <div key={ins.id} className="py-2.5 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${index === 0 ? 'bg-emerald-500' : 'bg-stone-300'}`} />
                      <span className="font-medium text-stone-800">
                        {formatDate(ins.generatedAt)}
                      </span>
                      <span className="text-stone-400">
                        {(() => {
                          const count: number = typeof ins.entryCount === 'number' && ins.entryCount > 0
                            ? ins.entryCount
                            : (ins.moodAnalysis?.moodDistribution
                                ? Object.values(ins.moodAnalysis.moodDistribution).reduce((sum: number, b: any): number => sum + (typeof b === 'number' ? b : 0), 0)
                                : 0);
                          return `(${count} ${count === 1 ? 'reflection' : 'reflections'} • ${ins.moodAnalysis.predominantMood})`;
                        })()}
                      </span>
                    </div>
                    {index === 0 ? (
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                        Current
                      </span>
                    ) : (
                      <span className="text-[10px] text-stone-400">Archived</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
