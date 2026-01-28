'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/router';
import { useLanguage } from '@/lib/i18n';
import { useAuth } from '@/lib/auth';
import {
  FileCheck,
  LayoutDashboard,
  Settings,
  Users,
  BarChart3,
  FileText,
  Menu,
  X,
  CreditCard,
  Receipt,
} from 'lucide-react';

interface MobileSidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export function MobileSidebar({ isOpen, onClose }: MobileSidebarProps) {
  const router = useRouter();
  const { t } = useLanguage();
  const { user, signOut } = useAuth();

  const navItems = [
    { href: '/', label: t.nav.dashboard, icon: LayoutDashboard },
    { href: '/documents', label: t.nav.documents, icon: FileCheck },
    { href: '/supporting-documents', label: t.nav.supportingDocuments, icon: FileCheck },
    { href: '/bank-statements', label: t.nav.bankStatements, icon: CreditCard },
    { href: '/supplier-statements', label: t.nav.supplierStatements, icon: Receipt },
    { href: '/coa-viewer', label: t.nav.coaViewer, icon: FileText },
    { href: '/chart-of-accounts', label: t.nav.accounts, icon: Users },
    { href: '/creditor-accounts', label: t.nav.creditors, icon: Menu },
    { href: '/settings', label: t.nav.settings, icon: Settings },
  ];

  const handleSignOut = async () => {
    try {
      await signOut();
      router.push('/login');
    } catch (error) {
      console.error('Sign out error:', error);
    }
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
    <>
      {/* Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 transition-opacity"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed top-0 left-0 z-50 h-full w-64 transform transition-transform duration-300 ease-in-out
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
        style={{
          background: 'var(--card)',
          borderRight: '1px solid var(--border)',
          color: 'var(--card-foreground)',
        }}
      >
        <div className="flex flex-col h-full">
          {/* Header with Logo and Close Button */}
          <div className="flex items-center justify-between px-4 py-4 border-b" style={{ borderBottomColor: 'var(--border)' }}>
            <Link href="/" className="flex items-center gap-2" onClick={onClose}>
              <div className="h-12 w-12 relative flex-shrink-0 rounded-lg" style={{ backgroundColor: 'white' }}>
                <Image
                  src="/smartdok.png"
                  alt="Smartdok.ai"
                  fill
                  className="object-contain"
                />
              </div>
              <span className="font-semibold text-lg" style={{ color: 'var(--foreground)' }}>
                Smartdok.ai
              </span>
            </Link>
            <button
              onClick={onClose}
              className="flex items-center justify-center rounded-lg p-2 transition-colors"
              style={{ color: 'var(--muted-foreground)' }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--muted)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
              }}
              aria-label="Close menu"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* User Info */}
          <div className="px-4 py-4 border-b" style={{ borderBottomColor: 'var(--border)' }}>
            <div className="flex items-center gap-3">
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
              <div className="flex flex-col flex-1 min-w-0">
                <span className="text-sm font-bold truncate" style={{ color: 'var(--foreground)' }}>
                  {user?.name || user?.email || 'User'}
                </span>
                <span className="text-xs truncate" style={{ color: 'var(--muted-foreground)' }}>
                  business
                </span>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto py-4">
            <ul className="space-y-1 px-2">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = router.pathname === item.href;

                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={onClose}
                      className="flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium transition-colors"
                      style={{
                        background: isActive ? 'var(--secondary)' : 'transparent',
                        color: isActive ? 'var(--secondary-foreground)' : 'var(--muted-foreground)',
                      }}
                      onMouseEnter={(e) => {
                        if (!isActive) {
                          e.currentTarget.style.background = 'var(--muted)';
                          e.currentTarget.style.color = 'var(--foreground)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!isActive) {
                          e.currentTarget.style.background = 'transparent';
                          e.currentTarget.style.color = 'var(--muted-foreground)';
                        }
                      }}
                    >
                      <Icon className="h-5 w-5 flex-shrink-0" />
                      <span>{item.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          {/* Footer with Logout */}
          <div className="px-4 py-4 border-t" style={{ borderTopColor: 'var(--border)' }}>
            <button
              onClick={handleSignOut}
              className="w-full text-left px-3 py-2 rounded-lg text-sm transition-colors"
              style={{ color: 'var(--muted-foreground)' }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--muted)';
                e.currentTarget.style.color = 'var(--foreground)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.color = 'var(--muted-foreground)';
              }}
            >
              {t.header.logout}
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}

