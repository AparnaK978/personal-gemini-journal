import React, { useState } from 'react';
import { Plus, Search, Trash2, Calendar, MessageSquare, Tag, Filter } from 'lucide-react';
import { JournalEntry, JournalMood } from '../types';

interface SidebarProps {
  entries: JournalEntry[];
  activeEntryId: string | null;
  onSelectEntry: (id: string) => void;
  onNewEntry: () => void;
  onDeleteEntry: (id: string, e: React.MouseEvent) => void;
  isLoading: boolean;
}

const MOOD_OPTIONS: { value: JournalMood | 'all'; label: string; dotColor: string }[] = [
  { value: 'all', label: 'All', dotColor: 'bg-stone-400' },
  { value: 'thoughtful', label: 'Thoughtful', dotColor: 'bg-indigo-500' },
  { value: 'grateful', label: 'Grateful', dotColor: 'bg-emerald-500' },
  { value: 'calm', label: 'Calm', dotColor: 'bg-teal-500' },
  { value: 'energized', label: 'Energized', dotColor: 'bg-amber-500' },
  { value: 'challenging', label: 'Challenging', dotColor: 'bg-rose-500' },
  { value: 'creative', label: 'Creative', dotColor: 'bg-purple-500' }
];

export const Sidebar: React.FC<SidebarProps> = ({
  entries,
  activeEntryId,
  onSelectEntry,
  onNewEntry,
  onDeleteEntry,
  isLoading
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMood, setSelectedMood] = useState<string>('all');

  const filteredEntries = entries.filter((entry) => {
    const matchesSearch =
      entry.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      entry.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (entry.tags && entry.tags.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase())));

    const matchesMood = selectedMood === 'all' || entry.mood === selectedMood;

    return matchesSearch && matchesMood;
  });

  const getMoodBadge = (mood?: string) => {
    switch (mood) {
      case 'thoughtful':
        return <span className="px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 text-[10px] font-medium border border-indigo-200/60">Thoughtful</span>;
      case 'grateful':
        return <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 text-[10px] font-medium border border-emerald-200/60">Grateful</span>;
      case 'calm':
        return <span className="px-2 py-0.5 rounded-md bg-teal-50 text-teal-700 text-[10px] font-medium border border-teal-200/60">Calm</span>;
      case 'energized':
        return <span className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 text-[10px] font-medium border border-amber-200/60">Energized</span>;
      case 'challenging':
        return <span className="px-2 py-0.5 rounded-md bg-rose-50 text-rose-700 text-[10px] font-medium border border-rose-200/60">Challenging</span>;
      case 'creative':
        return <span className="px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 text-[10px] font-medium border border-purple-200/60">Creative</span>;
      default:
        return null;
    }
  };

  const formatDate = (date: Date) => {
    if (!date) return '';
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    }).format(date);
  };

  return (
    <aside className="w-full md:w-80 lg:w-96 flex flex-col bg-white border-r border-stone-200 h-[calc(100vh-4rem)] flex-shrink-0">
      {/* Sidebar Header & New Entry */}
      <div className="p-4 border-b border-stone-200 space-y-3">
        <button
          onClick={onNewEntry}
          className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-stone-900 hover:bg-stone-800 text-stone-100 rounded-xl text-sm font-medium transition-all shadow-xs active:scale-[0.99] cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>New Journal Reflection</span>
        </button>

        {/* Search Bar */}
        <div className="relative">
          <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search entries, tags, reflections..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-stone-50 border border-stone-200 rounded-xl text-stone-800 placeholder-stone-400 focus:outline-none focus:ring-1 focus:ring-stone-400 focus:bg-white"
          />
        </div>

        {/* Mood Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs scrollbar-none">
          <Filter className="w-3 h-3 text-stone-400 flex-shrink-0" />
          {MOOD_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setSelectedMood(opt.value)}
              className={`px-2.5 py-1 rounded-lg text-[11px] whitespace-nowrap transition-colors flex-shrink-0 ${
                selectedMood === opt.value
                  ? 'bg-stone-900 text-white font-medium'
                  : 'bg-stone-100 text-stone-600 hover:bg-stone-200/70'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Entry List */}
      <div className="flex-1 overflow-y-auto divide-y divide-stone-100">
        {isLoading ? (
          <div className="p-6 text-center text-xs text-stone-600">
            <div className="w-5 h-5 border-2 border-stone-300 border-t-stone-800 rounded-full animate-spin mx-auto mb-2" />
            Loading your reflections from Firestore...
          </div>
        ) : filteredEntries.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-xs font-medium text-stone-600 mb-1">No journal entries found</p>
            <p className="text-[11px] text-stone-600">
              {entries.length === 0
                ? 'Create your first reflection to start conversing with Gemini.'
                : 'Try adjusting your search or mood filter.'}
            </p>
          </div>
        ) : (
          filteredEntries.map((entry) => {
            const isActive = entry.id === activeEntryId;
            return (
              <div
                key={entry.id}
                onClick={() => onSelectEntry(entry.id)}
                className={`p-4 cursor-pointer transition-colors relative group text-left ${
                  isActive
                    ? 'bg-stone-100/90 border-l-4 border-l-stone-900'
                    : 'hover:bg-stone-50'
                }`}
              >
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <h3 className="text-xs font-semibold text-stone-900 line-clamp-1">
                    {entry.title || 'Untitled Reflection'}
                  </h3>
                  <button
                    onClick={(e) => onDeleteEntry(entry.id, e)}
                    className="opacity-0 group-hover:opacity-100 p-1 text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-opacity"
                    title="Delete Entry"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                <p className="text-[11px] text-stone-500 line-clamp-2 mb-2 leading-relaxed">
                  {entry.summary || entry.content || '(Empty entry draft)'}
                </p>

                <div className="flex items-center justify-between gap-2 text-[10px] text-stone-400">
                  <div className="flex items-center gap-1.5">
                    {getMoodBadge(entry.mood)}
                    {entry.messageCount > 0 && (
                      <span className="inline-flex items-center gap-0.5 text-stone-500 font-medium">
                        <MessageSquare className="w-3 h-3" />
                        {entry.messageCount}
                      </span>
                    )}
                  </div>
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {formatDate(entry.updatedAt)}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footer info */}
      <div className="p-3 border-t border-stone-200 bg-stone-50/50 text-[11px] text-stone-400 flex items-center justify-between">
        <span>{entries.length} total entries</span>
        <span className="text-emerald-700 font-medium">Firestore Synced</span>
      </div>
    </aside>
  );
};
