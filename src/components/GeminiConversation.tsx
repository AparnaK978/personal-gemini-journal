import React, { useState, useRef, useEffect } from 'react';
import { Send, Sparkles, AlertCircle, User, Lightbulb, Trash2, RotateCcw } from 'lucide-react';
import { JournalMessage } from '../types';
import { ClearThreadModal } from './ClearThreadModal';
import { orderConversationMessages } from '../services/journalService';

interface GeminiConversationProps {
  messages: JournalMessage[];
  optimisticUserMessage?: string | null;
  onSendMessage: (text: string) => Promise<void>;
  onDeleteMessage?: (messageId: string) => Promise<void>;
  onClearConversation?: () => Promise<void>;
  isLoading: boolean;
  error: string | null;
  onClearError: () => void;
}

const STARTER_PROMPTS = [
  'Help me reframe this challenge positively',
  'What recurring cognitive patterns do you notice?',
  'Suggest 3 small, actionable next steps',
  'Help me brainstorm alternative solutions',
  'What should I be grateful for in this situation?'
];

export const GeminiConversation: React.FC<GeminiConversationProps> = ({
  messages,
  optimisticUserMessage,
  onSendMessage,
  onDeleteMessage,
  onClearConversation,
  isLoading,
  error,
  onClearError
}) => {
  const [inputText, setInputText] = useState('');
  const [lastFailedText, setLastFailedText] = useState<string | null>(null);
  const [isDeletingId, setIsDeletingId] = useState<string | null>(null);
  const [isClearing, setIsClearing] = useState(false);
  const [showClearModal, setShowClearModal] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const isSubmittingRef = useRef(false);

  // Auto scroll to bottom when new messages arrive or loading state changes
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading, optimisticUserMessage]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading || isSubmittingRef.current) return;
    const textToSend = inputText.trim();
    if (!textToSend) return;

    isSubmittingRef.current = true;
    onClearError();
    setLastFailedText(null);
    setInputText('');

    try {
      await onSendMessage(textToSend);
    } catch {
      // Restore input text so the user's draft is never lost on error
      setInputText(textToSend);
      setLastFailedText(textToSend);
    } finally {
      isSubmittingRef.current = false;
    }
  };

  const handlePromptClick = async (prompt: string) => {
    if (isLoading || isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    onClearError();
    setLastFailedText(null);

    try {
      await onSendMessage(prompt);
    } catch {
      setInputText(prompt);
      setLastFailedText(prompt);
    } finally {
      isSubmittingRef.current = false;
    }
  };

  const handleRetryFailed = async () => {
    if (!lastFailedText || isLoading) return;
    const retryText = lastFailedText;
    setLastFailedText(null);
    onClearError();
    try {
      await onSendMessage(retryText);
      setInputText('');
    } catch {
      setInputText(retryText);
      setLastFailedText(retryText);
    }
  };

  const handleDeleteMsg = async (msgId: string) => {
    if (!onDeleteMessage || isDeletingId) return;
    setIsDeletingId(msgId);
    try {
      await onDeleteMessage(msgId);
    } finally {
      setIsDeletingId(null);
    }
  };

  const handleOpenClearModal = () => {
    if (!onClearConversation || isLoading || isClearing) return;
    setShowClearModal(true);
  };

  const handleConfirmClear = async () => {
    if (!onClearConversation || isClearing) return;
    setIsClearing(true);
    try {
      await onClearConversation();
      setLastFailedText(null);
      setInputText('');
      setShowClearModal(false);
    } catch {
      // Error is caught and surfaced via onClearConversation / aiError
    } finally {
      setIsClearing(false);
    }
  };

  const orderedMessages = React.useMemo(() => {
    return orderConversationMessages(messages);
  }, [messages]);

  const totalTurns = orderedMessages.filter((m) => m.role === 'user').length;

  return (
    <div className="bg-white rounded-2xl border border-stone-200/80 shadow-xs flex flex-col overflow-hidden mb-6">
      {/* Header */}
      <div className="p-4 border-b border-stone-100 flex items-center justify-between bg-stone-50/50">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs font-semibold text-stone-900">
              Conversational Reflection with Gemini
            </h3>
            <p className="text-[10px] text-stone-500">
              Multi-turn dialogue saved strictly to your private Firestore account
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {orderedMessages.length > 0 && onClearConversation && (
            <button
              onClick={handleOpenClearModal}
              disabled={isLoading || isClearing}
              className="text-[11px] text-stone-500 hover:text-rose-600 px-2.5 py-1 rounded-lg border border-stone-200 bg-white hover:bg-rose-50 transition-colors disabled:opacity-40 cursor-pointer font-medium"
              title="Clear all reflection messages"
            >
              Clear Thread
            </button>
          )}

          <span className="text-[11px] font-medium text-stone-600 bg-stone-100 px-2 py-0.5 rounded-full border border-stone-200">
            {totalTurns} {totalTurns === 1 ? 'turn' : 'turns'} ({orderedMessages.length} msg)
          </span>
        </div>
      </div>

      {/* Message List */}
      <div className="p-4 sm:p-5 max-h-[480px] min-h-[160px] overflow-y-auto space-y-4">
        {orderedMessages.length === 0 && !optimisticUserMessage ? (
          <div className="text-center py-6 px-4">
            <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-700 flex items-center justify-center mx-auto mb-2.5">
              <Lightbulb className="w-5 h-5" />
            </div>
            <h4 className="text-xs font-semibold text-stone-800 mb-1">
              Start a reflective discussion
            </h4>
            <p className="text-[11px] text-stone-600 max-w-sm mx-auto mb-4 leading-relaxed">
              Ask Gemini to reflect on your entry, brainstorm action steps, or explore the root of what you are feeling.
            </p>

            {/* Quick Starter Chips */}
            <div className="flex flex-wrap justify-center gap-1.5 max-w-md mx-auto">
              {STARTER_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => handlePromptClick(prompt)}
                  disabled={isLoading}
                  className="px-2.5 py-1 text-xs bg-stone-50 hover:bg-stone-100 text-stone-700 border border-stone-200 rounded-lg transition-colors cursor-pointer text-left disabled:opacity-50"
                >
                  "{prompt}"
                </button>
              ))}
            </div>
          </div>
        ) : (
          orderedMessages.map((msg) => {
            const isUser = msg.role === 'user';
            const isDeleting = isDeletingId === msg.id;

            return (
              <div
                key={msg.id}
                className={`group relative flex gap-3 text-left ${isUser ? 'justify-end' : 'justify-start'}`}
              >
                {!isUser && (
                  <div className="w-7 h-7 rounded-lg bg-stone-900 text-amber-200 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Sparkles className="w-3.5 h-3.5" />
                  </div>
                )}

                {/* Delete button on hover */}
                {onDeleteMessage && (
                  <button
                    onClick={() => handleDeleteMsg(msg.id)}
                    disabled={isDeleting || isLoading}
                    className={`opacity-0 group-hover:opacity-100 transition-opacity p-1 text-stone-400 hover:text-rose-600 rounded self-center ${
                      isUser ? 'order-first mr-1' : 'order-last ml-1'
                    }`}
                    title="Delete message"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}

                <div
                  className={`max-w-[85%] rounded-2xl p-3.5 text-xs leading-relaxed transition-opacity ${
                    isDeleting ? 'opacity-40' : ''
                  } ${
                    isUser
                      ? 'bg-stone-900 text-stone-100 rounded-br-xs'
                      : 'bg-stone-50 text-stone-800 border border-stone-200/80 rounded-bl-xs'
                  }`}
                >
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                </div>

                {isUser && (
                  <div className="w-7 h-7 rounded-lg bg-stone-200 text-stone-700 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <User className="w-3.5 h-3.5" />
                  </div>
                )}
              </div>
            );
          })
        )}

        {/* Optimistic In-flight User Message */}
        {optimisticUserMessage && (
          <div className="flex gap-3 text-left justify-end animate-fade-in">
            <div className="max-w-[85%] rounded-2xl p-3.5 text-xs leading-relaxed bg-stone-900 text-stone-100 rounded-br-xs opacity-90">
              <p className="whitespace-pre-wrap">{optimisticUserMessage}</p>
            </div>
            <div className="w-7 h-7 rounded-lg bg-stone-200 text-stone-700 flex items-center justify-center flex-shrink-0 mt-0.5">
              <User className="w-3.5 h-3.5" />
            </div>
          </div>
        )}

        {/* Gemini Thinking / Streaming Indicator */}
        {isLoading && (
          <div className="flex gap-3 text-left justify-start animate-fade-in">
            <div className="w-7 h-7 rounded-lg bg-stone-900 text-amber-200 flex items-center justify-center flex-shrink-0 mt-0.5">
              <Sparkles className="w-3.5 h-3.5 animate-pulse" />
            </div>
            <div className="bg-stone-50 text-stone-600 border border-stone-200/80 rounded-2xl rounded-bl-xs p-3.5 text-xs flex items-center gap-2">
              <div className="flex space-x-1">
                <div className="w-1.5 h-1.5 bg-stone-400 rounded-full animate-bounce" />
                <div className="w-1.5 h-1.5 bg-stone-400 rounded-full animate-bounce [animation-delay:0.2s]" />
                <div className="w-1.5 h-1.5 bg-stone-400 rounded-full animate-bounce [animation-delay:0.4s]" />
              </div>
              <span className="text-[11px] text-stone-500">Gemini is reflecting on your entry...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Error Alert with Retry Action */}
      {error && (
        <div className="px-4 py-2.5 bg-rose-50 border-t border-rose-200 text-rose-700 text-xs flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span className="truncate">{error}</span>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {lastFailedText && (
              <button
                onClick={handleRetryFailed}
                disabled={isLoading}
                className="inline-flex items-center gap-1 px-2 py-0.5 bg-white hover:bg-rose-100 text-rose-800 border border-rose-300 rounded font-medium text-[11px] transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Retry</span>
              </button>
            )}
            <button
              onClick={onClearError}
              className="text-rose-700 hover:text-rose-900 font-bold px-1 cursor-pointer"
              title="Dismiss"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* Quick Prompts Bar (when conversation already started) */}
      {messages.length > 0 && (
        <div className="px-4 py-2 border-t border-stone-100 bg-stone-50/50 flex items-center gap-1.5 overflow-x-auto scrollbar-none text-[11px]">
          <span className="text-stone-400 whitespace-nowrap">Suggested:</span>
          {STARTER_PROMPTS.slice(0, 3).map((prompt) => (
            <button
              key={prompt}
              onClick={() => handlePromptClick(prompt)}
              disabled={isLoading}
              className="px-2 py-0.5 bg-white hover:bg-stone-100 text-stone-600 border border-stone-200 rounded-md transition-colors whitespace-nowrap cursor-pointer flex-shrink-0 disabled:opacity-40"
            >
              {prompt}
            </button>
          ))}
        </div>
      )}

      {/* Input Form with strict duplicate submission prevention */}
      <form onSubmit={handleSubmit} className="p-3 border-t border-stone-200 bg-white">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder={
              isLoading
                ? 'Gemini reflection in progress, please wait...'
                : 'Ask Gemini to explore, brainstorm, or reframe this entry...'
            }
            disabled={isLoading}
            className="flex-1 text-xs bg-stone-50 border border-stone-200 rounded-xl px-3.5 py-2.5 text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-1 focus:ring-stone-400 focus:bg-white disabled:opacity-50 disabled:bg-stone-100"
          />
          <button
            type="submit"
            disabled={!inputText.trim() || isLoading}
            className="p-2.5 bg-stone-900 hover:bg-stone-800 text-stone-100 rounded-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex-shrink-0"
            title="Send to Gemini"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </form>

      {/* Confirmation Modal for Clearing Thread */}
      <ClearThreadModal
        isOpen={showClearModal}
        messageCount={messages.length}
        onConfirm={handleConfirmClear}
        onCancel={() => !isClearing && setShowClearModal(false)}
        isClearing={isClearing}
      />
    </div>
  );
};
