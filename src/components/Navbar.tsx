import React from 'react';
import { BookOpen, Shield, LogOut, User as UserIcon, Sparkles } from 'lucide-react';
import { AppUser } from '../types';

interface NavbarProps {
  user: AppUser | null;
  currentView: 'journal' | 'insights';
  onViewChange: (view: 'journal' | 'insights') => void;
  onSignOut: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  user,
  currentView,
  onViewChange,
  onSignOut
}) => {
  return (
    <header className="border-b border-stone-200 bg-stone-50/80 backdrop-blur-md sticky top-0 z-30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-stone-900 text-stone-100 flex items-center justify-center shadow-sm">
            <BookOpen className="w-5 h-5 text-amber-200" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-stone-900 text-lg tracking-tight">
                Personal Gemini Journal
              </span>
              <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                <Shield className="w-3 h-3" /> Zero-Trust Isolated
              </span>
            </div>
            <p className="text-xs text-stone-500 hidden sm:block">
              Private reflective journal with AI-guided conversations & synthesis
            </p>
          </div>
        </div>

        {/* Center Nav tabs when authenticated */}
        {user && (
          <div className="flex items-center p-1 bg-stone-200/60 rounded-xl border border-stone-200/70">
            <button
              onClick={() => onViewChange('journal')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                currentView === 'journal'
                  ? 'bg-white text-stone-900 shadow-2xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>Journal</span>
            </button>
            <button
              onClick={() => onViewChange('insights')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                currentView === 'insights'
                  ? 'bg-white text-stone-900 shadow-2xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              <Sparkles className={`w-3.5 h-3.5 ${currentView === 'insights' ? 'text-amber-600' : 'text-stone-500'}`} />
              <span>Insights</span>
            </button>
          </div>
        )}

        {user && (
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-2.5 px-3 py-1.5 rounded-xl bg-white border border-stone-200/70 shadow-xs">
              {user.photoURL ? (
                <img
                  src={user.photoURL}
                  alt={user.displayName || 'User'}
                  className="w-7 h-7 rounded-full object-cover border border-stone-200"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-7 h-7 rounded-full bg-stone-100 text-stone-600 flex items-center justify-center">
                  <UserIcon className="w-4 h-4" />
                </div>
              )}
              <div className="text-left hidden md:block">
                <p className="text-xs font-medium text-stone-900 leading-tight truncate max-w-[130px]">
                  {user.displayName || 'Journalist'}
                </p>
                <p className="text-[10px] text-stone-500 truncate max-w-[130px]">
                  {user.email || 'Authenticated'}
                </p>
              </div>
            </div>

            <button
              onClick={onSignOut}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-stone-600 hover:text-stone-900 hover:bg-stone-200/60 rounded-xl transition-colors cursor-pointer"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>
        )}
      </div>
    </header>
  );
};

