'use client';

import { useAuth } from '@/lib/auth';
import { useLanguage } from '@/lib/i18n';
import { Moon, Sun, Menu, Plus } from 'lucide-react';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
// import { LanguageSwitcher } from './LanguageSwitcher';

interface MobileHeaderProps {
  pageName?: string;
  onMenuClick: () => void;
}

export function MobileHeader({ pageName = 'Dashboard', onMenuClick }: MobileHeaderProps) {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const router = useRouter();

  // Initialize theme from localStorage
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') as 'light' | 'dark' | null;
    if (savedTheme) {
      setTheme(savedTheme);
      document.documentElement.setAttribute('data-theme', savedTheme);
    } else {
      // Check system preference
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      const defaultTheme = prefersDark ? 'dark' : 'light';
      setTheme(defaultTheme);
      document.documentElement.setAttribute('data-theme', defaultTheme);
    }
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
  };

  // Get user initials for avatar
  const getInitials = () => {
    if (user?.name) {
      return user.name
        .split(' ')
        .map(n => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);
    }
    return user?.email?.[0]?.toUpperCase() || 'U';
  };

  return (
    <header
      className="flex h-14 items-center justify-between px-4 gap-2"
      style={{
        background: 'var(--card)',
        borderBottom: '1px solid var(--border)',
        color: 'var(--card-foreground)'
      }}
    >
      {/* Left side - Menu Button + Page Name */}
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <button
          onClick={onMenuClick}
          className="flex items-center justify-center rounded-lg p-2 transition-colors flex-shrink-0"
          style={{ color: 'var(--muted-foreground)' }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'var(--muted)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent';
          }}
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </button>

        {/* Page Name */}
        <h1 className="text-lg font-semibold truncate" style={{ color: 'var(--foreground)' }}>
          {pageName}
        </h1>
      </div>

      {/* Right side - Compact controls */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {/* Add Documents Button - Icon only */}
        <button
          className="flex items-center justify-center rounded-lg p-2 transition-colors"
          style={{
            background: 'var(--primary)',
            color: 'var(--primary-foreground)'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.opacity = '0.9';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.opacity = '1';
          }}
          onClick={() => {
            router.push("/documents/batch");
          }}
          aria-label={t.header.addDocument}
        >
          <Plus className="h-5 w-5" />
        </button>

        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          className="flex items-center justify-center rounded-lg p-2 transition-colors"
          style={{ color: 'var(--muted-foreground)' }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'var(--muted)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent';
          }}
          aria-label="Toggle theme"
        >
          {theme === 'light' ? (
            <Moon className="h-5 w-5" />
          ) : (
            <Sun className="h-5 w-5" />
          )}
        </button>

        {/* Avatar */}
        {user?.avatar ? (
          <img
            src={user.avatar}
            alt={user.name || 'User'}
            className="h-8 w-8 rounded-full object-cover"
            style={{ border: '2px solid var(--border)' }}
          />
        ) : (
          <div
            className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold"
            style={{
              background: 'var(--accent)',
              color: 'var(--accent-foreground)',
              border: '2px solid var(--border)'
            }}
          >
            {getInitials()}
          </div>
        )}
      </div>
    </header>
  );
}

