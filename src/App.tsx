import React, { useState, useEffect, useRef } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, signInWithGoogle, signOutUser } from './lib/firebase';
import { AppUser, JournalEntry, JournalMessage } from './types';
import {
  subscribeToEntries,
  subscribeToMessages,
  createJournalEntry,
  updateJournalEntry,
  deleteJournalEntry,
  addJournalMessage,
  addJournalConversationTurn,
  orderConversationMessages,
  deleteJournalMessage,
  clearJournalMessages
} from './services/journalService';
import { askGemini, generateJournalSummary } from './services/aiService';
import { Navbar } from './components/Navbar';
import { LandingPage } from './components/LandingPage';
import { Sidebar } from './components/Sidebar';
import { JournalEditor } from './components/JournalEditor';
import { GeminiConversation } from './components/GeminiConversation';
import { GeminiSummarySection } from './components/GeminiSummarySection';
import { DeleteModal } from './components/DeleteModal';
import { BookOpen, Plus, Sparkles, Shield } from 'lucide-react';

export default function App() {
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  // Journal Entries state
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [activeEntryId, setActiveEntryId] = useState<string | null>(null);
  const [entriesLoading, setEntriesLoading] = useState(false);
  const [entriesError, setEntriesError] = useState<string | null>(null);

  // Active Entry Messages state
  const [messages, setMessages] = useState<JournalMessage[]>([]);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [optimisticMessage, setOptimisticMessage] = useState<string | null>(null);
  const isSendingRef = useRef(false);

  // Summarizing state
  const [isSummarizing, setIsSummarizing] = useState(false);

  // Delete modal state
  const [entryToDelete, setEntryToDelete] = useState<JournalEntry | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // 1. Listen for Firebase Auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(
      auth,
      (user) => {
        if (user) {
          setCurrentUser({
            uid: user.uid,
            email: user.email,
            displayName: user.displayName,
            photoURL: user.photoURL
          });
        } else {
          setCurrentUser(null);
          setEntries([]);
          setActiveEntryId(null);
          setMessages([]);
        }
        setAuthLoading(false);
      },
      (error) => {
        console.error('Auth state change error:', error);
        setAuthError(error.message);
        setAuthLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  // 2. Subscribe to user entries from Firestore when authenticated
  useEffect(() => {
    if (!currentUser) return;

    setEntriesLoading(true);
    const unsubscribe = subscribeToEntries(
      currentUser.uid,
      (updatedEntries) => {
        setEntries(updatedEntries);
        setEntriesLoading(false);

        // Auto-select first entry if none selected
        setActiveEntryId((prev) => {
          if (prev && updatedEntries.some((e) => e.id === prev)) {
            return prev;
          }
          return updatedEntries.length > 0 ? updatedEntries[0].id : null;
        });
      },
      (err) => {
        console.error('Firestore entries subscription error:', err);
        setEntriesError('Unable to load entries. Please verify network connectivity.');
        setEntriesLoading(false);
      }
    );

    return () => unsubscribe();
  }, [currentUser]);

  // 3. Subscribe to messages of active entry
  useEffect(() => {
    if (!currentUser || !activeEntryId) {
      setMessages([]);
      return;
    }

    const unsubscribe = subscribeToMessages(
      currentUser.uid,
      activeEntryId,
      (updatedMessages) => {
        setMessages(updatedMessages);
      },
      (err) => {
        console.error('Firestore messages subscription error:', err);
      }
    );

    return () => unsubscribe();
  }, [currentUser, activeEntryId]);

  // Auth Handlers
  const handleSignIn = async () => {
    setAuthError(null);
    try {
      await signInWithGoogle();
    } catch (err: any) {
      if (err?.code !== 'auth/popup-closed-by-user') {
        setAuthError(err?.message || 'Failed to sign in with Google');
      }
    }
  };

  const handleSignOut = async () => {
    try {
      await signOutUser();
    } catch (err: any) {
      console.error('Sign out error:', err);
    }
  };

  // Journal Actions
  const handleCreateNewEntry = async () => {
    if (!currentUser) return;
    try {
      const newId = await createJournalEntry(currentUser.uid, {
        title: 'New Reflection',
        content: '',
        mood: 'thoughtful',
        tags: []
      });
      setActiveEntryId(newId);
    } catch (err: any) {
      console.error('Create entry error:', err);
    }
  };

  const handleUpdateActiveEntry = async (updatedFields: Partial<JournalEntry>) => {
    if (!currentUser || !activeEntryId) return;
    await updateJournalEntry(currentUser.uid, activeEntryId, updatedFields);
  };

  const handleDeleteRequest = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const target = entries.find((entry) => entry.id === id);
    if (target) {
      setEntryToDelete(target);
    }
  };

  const handleConfirmDelete = async () => {
    if (!currentUser || !entryToDelete) return;
    setIsDeleting(true);
    try {
      await deleteJournalEntry(currentUser.uid, entryToDelete.id);
      if (activeEntryId === entryToDelete.id) {
        const remaining = entries.filter((e) => e.id !== entryToDelete.id);
        setActiveEntryId(remaining.length > 0 ? remaining[0].id : null);
      }
      setEntryToDelete(null);
    } catch (err) {
      console.error('Failed to delete entry:', err);
    } finally {
      setIsDeleting(false);
    }
  };

  // Gemini Multi-turn Chat Handler
  const handleSendMessage = async (text: string) => {
    if (!currentUser || !activeEntryId || isSendingRef.current || isAiLoading) {
      return;
    }

    const trimmedText = text.trim();
    if (!trimmedText) return;

    isSendingRef.current = true;
    setIsAiLoading(true);
    setAiError(null);
    setOptimisticMessage(trimmedText);

    const activeEntry = entries.find((e) => e.id === activeEntryId);

    try {
      // 1. Prepare conversation history from persisted messages in proper alternating order
      const orderedForHistory = orderConversationMessages(messages);
      const historyPayload = orderedForHistory.map((m) => ({
        role: m.role,
        content: m.content
      }));

      // 2. Call server-side Gemini API (secrets stay server-side)
      const geminiResponse = await askGemini(
        activeEntryId,
        trimmedText,
        historyPayload,
        activeEntry
          ? {
              title: activeEntry.title,
              content: activeEntry.content,
              mood: activeEntry.mood
            }
          : undefined
      );

      // 3. Atomically persist user turn and Gemini turn with sequential indexing
      // This prevents orphaned user turns, duplicate turns, or timestamp drift
      if (geminiResponse && geminiResponse.reply) {
        await addJournalConversationTurn(
          currentUser.uid,
          activeEntryId,
          trimmedText,
          geminiResponse.reply,
          messages.length
        );
        setEntries((prev) =>
          prev.map((e) =>
            e.id === activeEntryId
              ? { ...e, messageCount: (e.messageCount || 0) + 2 }
              : e
          )
        );
      }
      setOptimisticMessage(null);
    } catch (err: any) {
      console.error('AI chat error:', err);
      // Remove optimistic message so the chat state remains pristine
      setOptimisticMessage(null);
      // Display friendly error and re-throw so input can be preserved
      setAiError(err.message || 'Gemini reflection unavailable. Please retry.');
      throw err;
    } finally {
      isSendingRef.current = false;
      setIsAiLoading(false);
    }
  };

  const handleDeleteMessage = async (messageId: string) => {
    if (!currentUser || !activeEntryId) return;
    try {
      setMessages((prev) => prev.filter((m) => m.id !== messageId));
      setEntries((prev) =>
        prev.map((e) =>
          e.id === activeEntryId
            ? { ...e, messageCount: Math.max(0, (e.messageCount || 1) - 1) }
            : e
        )
      );
      await deleteJournalMessage(currentUser.uid, activeEntryId, messageId);
    } catch (err: any) {
      console.error('Failed to delete message:', err);
      setAiError('Failed to delete message. Please retry.');
    }
  };

  const handleClearConversation = async () => {
    if (!currentUser || !activeEntryId || isAiLoading) return;
    try {
      // 1. Instantly reset local messages and error state
      setMessages([]);
      setOptimisticMessage(null);
      setAiError(null);

      // 2. Instantly update messageCount on the active entry in the sidebar list
      setEntries((prev) =>
        prev.map((e) => (e.id === activeEntryId ? { ...e, messageCount: 0 } : e))
      );

      // 3. Permanently remove all messages from Firestore and reset messageCount
      await clearJournalMessages(currentUser.uid, activeEntryId);
    } catch (err: any) {
      console.error('Failed to clear conversation:', err);
      setAiError(err.message || 'Failed to clear reflection thread. Please retry.');
      throw err;
    }
  };

  // Gemini Summarization Handler
  const handleGenerateSummary = async () => {
    if (!currentUser || !activeEntryId) return;

    const activeEntry = entries.find((e) => e.id === activeEntryId);
    if (!activeEntry) return;

    setIsSummarizing(true);
    try {
      const summaryResult = await generateJournalSummary(
        activeEntryId,
        activeEntry.title,
        activeEntry.content,
        activeEntry.mood || 'thoughtful',
        messages.map((m) => ({ role: m.role, content: m.content }))
      );

      // Update Firestore entry document
      await updateJournalEntry(currentUser.uid, activeEntryId, {
        summary: summaryResult.summary,
        mood: summaryResult.mood,
        insights: summaryResult.insights,
        actionItems: summaryResult.actionItems,
        tags: Array.from(new Set([...(activeEntry.tags || []), ...(summaryResult.tags || [])]))
      });
    } catch (err: any) {
      console.error('Summary generation error:', err);
      setAiError(err.message || 'Failed to synthesize journal entry.');
    } finally {
      setIsSummarizing(false);
    }
  };

  const activeEntry = entries.find((e) => e.id === activeEntryId) || null;

  return (
    <div className="min-h-screen bg-stone-100 flex flex-col font-sans text-stone-900">
      {/* Top Navigation */}
      <Navbar user={currentUser} onSignOut={handleSignOut} />

      {/* Main Container */}
      {authLoading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-3 border-stone-300 border-t-stone-800 rounded-full animate-spin" />
            <p className="text-xs text-stone-500 font-medium">Verifying Firebase Authentication...</p>
          </div>
        </div>
      ) : !currentUser ? (
        <LandingPage
          onSignIn={handleSignIn}
          isLoading={authLoading}
          error={authError}
        />
      ) : (
        <div className="flex-1 flex flex-col md:flex-row max-w-7xl w-full mx-auto overflow-hidden">
          {/* Sidebar */}
          <Sidebar
            entries={entries}
            activeEntryId={activeEntryId}
            onSelectEntry={(id) => setActiveEntryId(id)}
            onNewEntry={handleCreateNewEntry}
            onDeleteEntry={(id, e) => handleDeleteRequest(id, e)}
            isLoading={entriesLoading}
          />

          {/* Main Reflection Workspace */}
          <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto h-[calc(100vh-4rem)]">
            {entriesLoading && entries.length === 0 ? (
              <div className="h-full flex items-center justify-center">
                <div className="flex flex-col items-center gap-2">
                  <div className="w-6 h-6 border-2 border-stone-300 border-t-stone-800 rounded-full animate-spin" />
                  <span className="text-xs text-stone-500">Connecting to Firestore...</span>
                </div>
              </div>
            ) : activeEntry ? (
              <div className="max-w-3xl mx-auto space-y-6">
                {/* 1. Core Journal Editor */}
                <JournalEditor
                  key={activeEntry.id}
                  entry={activeEntry}
                  onUpdate={handleUpdateActiveEntry}
                  onDelete={() => handleDeleteRequest(activeEntry.id)}
                  onGenerateSummary={handleGenerateSummary}
                  isSummarizing={isSummarizing}
                />

                {/* 2. Structured Gemini Summary Section */}
                <GeminiSummarySection
                  entry={activeEntry}
                  onGenerateSummary={handleGenerateSummary}
                  isSummarizing={isSummarizing}
                />

                {/* 3. Multi-turn Conversational Thread */}
                <GeminiConversation
                  messages={messages}
                  optimisticUserMessage={optimisticMessage}
                  onSendMessage={handleSendMessage}
                  onDeleteMessage={handleDeleteMessage}
                  onClearConversation={handleClearConversation}
                  isLoading={isAiLoading}
                  error={aiError}
                  onClearError={() => setAiError(null)}
                />
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center p-8">
                <div className="w-12 h-12 rounded-2xl bg-stone-200/80 text-stone-600 flex items-center justify-center mb-4">
                  <BookOpen className="w-6 h-6" />
                </div>
                <h2 className="text-base font-semibold text-stone-900 mb-1">
                  Welcome to your Personal Journal
                </h2>
                <p className="text-xs text-stone-500 max-w-sm mb-6 leading-relaxed">
                  Start a fresh reflection to explore your thoughts and engage in private multi-turn discussions with Gemini.
                </p>
                <button
                  onClick={handleCreateNewEntry}
                  className="inline-flex items-center gap-2 px-4 py-2.5 bg-stone-900 hover:bg-stone-800 text-stone-100 rounded-xl text-xs font-medium transition-all shadow-xs cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Create Your First Reflection</span>
                </button>
              </div>
            )}
          </main>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <DeleteModal
        isOpen={Boolean(entryToDelete)}
        title={entryToDelete?.title || ''}
        onConfirm={handleConfirmDelete}
        onCancel={() => setEntryToDelete(null)}
        isDeleting={isDeleting}
      />
    </div>
  );
}
