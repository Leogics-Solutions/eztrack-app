'use client';

import { useAuth } from '@/lib/auth';
import { useLanguage } from '@/lib/i18n';
import { Moon, Sun, ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
// import { LanguageSwitcher } from './LanguageSwitcher';

interface HeaderProps {
  pageName?: string;
  isCollapsed: boolean;
  onToggle: () => void;
}

export function Header({ pageName = 'Dashboard', isCollapsed, onToggle }: HeaderProps) {
  const { user, signOut } = useAuth();
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

  const handleSignOut = async () => {
    try {
      await signOut();
      router.push('/login');
    } catch (error) {
      console.error('Sign out error:', error);
      // Still redirect to login even if signOut fails
      router.push('/login');
    }
  };

  // Get user initials for avatar
  const getInitials = () => {
    const baseName = user?.name || (user as any)?.full_name || '';
    if (baseName) {
      return baseName
        .split(' ')
        .filter(Boolean)
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);
    }
    return user?.email?.[0]?.toUpperCase() || 'U';
  };

  const displayName =
    user?.name || (user as any)?.full_name || user?.email || '';

  return (
    <header
      className="flex h-16 items-center justify-between px-6 gap-4"
      style={{
        background: 'var(--card)',
        borderBottom: '1px solid var(--border)',
        color: 'var(--card-foreground)'
      }}
    >
      {/* Left side - Collapse Button + Page Name */}
      <div className="flex items-center gap-4">
        {/* Collapse Button */}
        <button
          onClick={onToggle}
          className="flex items-center justify-center rounded-lg p-2 transition-colors"
          style={{ color: 'var(--muted-foreground)' }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'var(--muted)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent';
          }}
          aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {isCollapsed ? (
            <ChevronRight className="h-5 w-5" />
          ) : (
            <ChevronLeft className="h-5 w-5" />
          )}
        </button>

        {/* Page Name */}
        <h1 className="text-xl font-semibold" style={{ color: 'var(--foreground)' }}>
          {pageName}
        </h1>
      </div>

      {/* Right side - Language Switcher, Theme Toggle, Avatar, Username/Business, Logout */}
      <div className="flex items-center gap-6">
        {/* Language Switcher */}
        {/* <LanguageSwitcher /> */}

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
            className="h-10 w-10 rounded-full object-cover"
            style={{ border: '2px solid var(--border)' }}
          />
        ) : (
          <div
            className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold"
            style={{
              background: 'var(--accent)',
              color: 'var(--accent-foreground)',
              border: '2px solid var(--border)'
            }}
          >
            {getInitials()}
          </div>
        )}

        {/* Username and Business */}
        <div className="flex flex-col">
          <span className="text-sm font-bold" style={{ color: 'var(--foreground)' }}>
            {displayName || '—'}
          </span>
          <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
            business
          </span>
        </div>

        {/* Add Documents Button */}
        <button
          className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors"
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
          onClick={()=>{
            router.push("/documents/batch")
          }}
        >
          <Plus className="h-4 w-4" />
          {t.header.addDocument}
        </button>

        {/* Logout */}
        <button
          onClick={handleSignOut}
          className="text-sm underline transition-colors"
          style={{ color: 'var(--muted-foreground)' }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = 'var(--foreground)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = 'var(--muted-foreground)';
          }}
        >
          {t.header.logout}
        </button>
      </div>
    </header>
  );
}
