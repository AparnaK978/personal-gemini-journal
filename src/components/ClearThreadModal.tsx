import React from 'react';
import { MessageSquareX, Sparkles } from 'lucide-react';

interface ClearThreadModalProps {
  isOpen: boolean;
  messageCount: number;
  onConfirm: () => void;
  onCancel: () => void;
  isClearing: boolean;
}

export const ClearThreadModal: React.FC<ClearThreadModalProps> = ({
  isOpen,
  messageCount,
  onConfirm,
  onCancel,
  isClearing
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/40 backdrop-blur-xs p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isClearing) onCancel();
      }}
    >
      <div className="bg-white rounded-2xl border border-stone-200 p-6 max-w-sm w-full shadow-lg text-left">
        <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center mb-4">
          <MessageSquareX className="w-5 h-5" />
        </div>

        <h3 className="text-sm font-semibold text-stone-900 mb-1">
          Clear Reflection Thread?
        </h3>
        <p className="text-xs text-stone-500 mb-5 leading-relaxed">
          This will permanently delete{' '}
          <span className="font-semibold text-stone-800">
            {messageCount} {messageCount === 1 ? 'message' : 'messages'}
          </span>{' '}
          from this reflection in your private Firestore database. Your journal entry title, notes, and summary will remain safe.
        </p>

        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={isClearing}
            className="px-3.5 py-2 text-xs font-medium text-stone-600 hover:text-stone-900 hover:bg-stone-100 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isClearing}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-stone-900 hover:bg-stone-800 rounded-xl transition-colors shadow-xs cursor-pointer disabled:opacity-50"
          >
            {isClearing ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-stone-400 border-t-white rounded-full animate-spin" />
                <span>Clearing...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5" />
                <span>Clear Thread</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
