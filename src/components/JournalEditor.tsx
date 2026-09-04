import React, { useState, useEffect } from 'react';
import { Sparkles, Save, Tag as TagIcon, Check, Trash2, Clock, AlertCircle } from 'lucide-react';
import { JournalEntry, JournalMood } from '../types';

interface JournalEditorProps {
  entry: JournalEntry;
  onUpdate: (updatedFields: Partial<JournalEntry>) => Promise<void>;
  onDelete: () => void;
  onGenerateSummary: () => void;
  isSummarizing: boolean;
}

const MOODS: { value: JournalMood; label: string; bg: string; text: string }[] = [
  { value: 'thoughtful', label: 'Thoughtful', bg: 'bg-indigo-50 border-indigo-200', text: 'text-indigo-700' },
  { value: 'grateful', label: 'Grateful', bg: 'bg-emerald-50 border-emerald-200', text: 'text-emerald-700' },
  { value: 'calm', label: 'Calm', bg: 'bg-teal-50 border-teal-200', text: 'text-teal-700' },
  { value: 'energized', label: 'Energized', bg: 'bg-amber-50 border-amber-200', text: 'text-amber-800' },
  { value: 'challenging', label: 'Challenging', bg: 'bg-rose-50 border-rose-200', text: 'text-rose-700' },
  { value: 'creative', label: 'Creative', bg: 'bg-purple-50 border-purple-200', text: 'text-purple-700' }
];

export const JournalEditor: React.FC<JournalEditorProps> = ({
  entry,
  onUpdate,
  onDelete,
  onGenerateSummary,
  isSummarizing
}) => {
  const [title, setTitle] = useState(entry.title || '');
  const [content, setContent] = useState(entry.content || '');
  const [mood, setMood] = useState<string>(entry.mood || 'thoughtful');
  const [tags, setTags] = useState<string[]>(entry.tags || []);
  const [tagInput, setTagInput] = useState('');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'unsaved'>('idle');

  // Sync internal state when entry changes
  useEffect(() => {
    setTitle(entry.title || '');
    setContent(entry.content || '');
    setMood(entry.mood || 'thoughtful');
    setTags(entry.tags || []);
    setSaveStatus('idle');
  }, [entry.id]);

  // Debounced auto-save on change
  useEffect(() => {
    if (
      title === (entry.title || '') &&
      content === (entry.content || '') &&
      mood === (entry.mood || 'thoughtful') &&
      JSON.stringify(tags) === JSON.stringify(entry.tags || [])
    ) {
      return;
    }

    setSaveStatus('unsaved');
    const timer = setTimeout(async () => {
      try {
        setSaveStatus('saving');
        await onUpdate({
          title: title.trim() || 'Untitled Reflection',
          content,
          mood,
          tags
        });
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus('idle'), 2000);
      } catch (err) {
        console.error('Save failed:', err);
        setSaveStatus('unsaved');
      }
    }, 1200);

    return () => clearTimeout(timer);
  }, [title, content, mood, tags]);

  const handleManualSave = async () => {
    setSaveStatus('saving');
    try {
      await onUpdate({
        title: title.trim() || 'Untitled Reflection',
        content,
        mood,
        tags
      });
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch {
      setSaveStatus('unsaved');
    }
  };

  const handleAddTag = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && tagInput.trim()) {
      e.preventDefault();
      const cleaned = tagInput.trim().toLowerCase().replace(/^#/, '');
      if (!tags.includes(cleaned)) {
        setTags([...tags, cleaned]);
      }
      setTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter((t) => t !== tagToRemove));
  };

  return (
    <div className="bg-white rounded-2xl border border-stone-200/80 shadow-xs p-5 sm:p-6 mb-6">
      {/* Top Controls Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 mb-4 border-b border-stone-100">
        <div className="flex items-center gap-2">
          {saveStatus === 'saving' && (
            <span className="inline-flex items-center gap-1 text-[11px] text-stone-500 font-medium">
              <Clock className="w-3 h-3 animate-spin" /> Saving...
            </span>
          )}
          {saveStatus === 'saved' && (
            <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600 font-medium">
              <Check className="w-3 h-3" /> Saved to Firestore
            </span>
          )}
          {saveStatus === 'unsaved' && (
            <span className="inline-flex items-center gap-1 text-[11px] text-amber-600 font-medium">
              <AlertCircle className="w-3 h-3" /> Unsaved changes
            </span>
          )}
          {saveStatus === 'idle' && (
            <span className="text-[11px] text-stone-400">
              Synced with Cloud Firestore
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleManualSave}
            disabled={saveStatus === 'saving'}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-stone-700 hover:text-stone-900 bg-stone-100 hover:bg-stone-200/80 transition-colors cursor-pointer"
          >
            <Save className="w-3.5 h-3.5" />
            <span>Save</span>
          </button>

          <button
            onClick={onGenerateSummary}
            disabled={isSummarizing || !content.trim()}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-medium text-amber-900 bg-amber-100 hover:bg-amber-200 border border-amber-300/60 transition-colors shadow-xs cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Sparkles className={`w-3.5 h-3.5 text-amber-700 ${isSummarizing ? 'animate-spin' : ''}`} />
            <span>{isSummarizing ? 'Synthesizing...' : 'Gemini Synthesis'}</span>
          </button>

          <button
            onClick={onDelete}
            className="p-1.5 text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
            title="Delete this entry"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Entry Title */}
      <div className="mb-4">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Give this reflection a title..."
          className="w-full text-xl sm:text-2xl font-semibold text-stone-900 placeholder-stone-300 focus:outline-none focus:ring-0 border-none px-0 tracking-tight"
        />
      </div>

      {/* Mood Selector Pills */}
      <div className="mb-4">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-medium text-stone-600 mr-1">Current Mood:</span>
          {MOODS.map((m) => {
            const isSelected = mood === m.value;
            return (
              <button
                key={m.value}
                onClick={() => setMood(m.value)}
                className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-all cursor-pointer ${
                  isSelected
                    ? `${m.bg} ${m.text} shadow-xs ring-1 ring-offset-1 ring-stone-400`
                    : 'bg-stone-50 border-stone-200 text-stone-600 hover:bg-stone-100'
                }`}
              >
                {m.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Journal Body */}
      <div className="mb-4">
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="What is on your mind? Write freely about your day, challenges, gratitude, or aspirations..."
          rows={7}
          className="w-full text-sm text-stone-800 leading-relaxed placeholder-stone-300 focus:outline-none resize-y border border-stone-200 rounded-xl p-3.5 bg-stone-50/40 focus:bg-white focus:border-stone-400 transition-colors"
        />
        <div className="flex items-center justify-between text-[11px] text-stone-600 mt-1 px-1">
          <span>{content.split(/\s+/).filter(Boolean).length} words • {content.length} characters</span>
          <span>Press "Gemini Synthesis" above for AI cognitive insights</span>
        </div>
      </div>

      {/* Tags Row */}
      <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-stone-100">
        <TagIcon className="w-3.5 h-3.5 text-stone-400" />
        {tags.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-stone-100 text-stone-700 text-xs border border-stone-200"
          >
            #{tag}
            <button
              onClick={() => handleRemoveTag(tag)}
              className="text-stone-400 hover:text-stone-700 ml-0.5 text-xs font-bold"
            >
              ×
            </button>
          </span>
        ))}
        <input
          type="text"
          value={tagInput}
          onChange={(e) => setTagInput(e.target.value)}
          onKeyDown={handleAddTag}
          placeholder="+ Add tag (Press Enter)"
          className="text-xs bg-transparent border-none text-stone-600 placeholder-stone-400 focus:outline-none py-0.5 px-1 max-w-[140px]"
        />
      </div>
    </div>
  );
};
