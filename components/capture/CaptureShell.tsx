'use client';

import Link from 'next/link';
import { useRouter } from 'next/router';
import { Bot, FlaskConical, Inbox, RadioTower } from 'lucide-react';

const TABS = [
  { href: '/capture', label: 'Smart Inbox', icon: Inbox, exact: true },
  { href: '/capture/channels', label: 'Channels', icon: RadioTower },
  { href: '/capture/rules', label: 'Rules & AI', icon: Bot },
  { href: '/capture/playground', label: 'Playground', icon: FlaskConical },
];

export function CaptureShell({
  title,
  description,
  actions,
  children,
}: {
  title: string;
  description: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  const router = useRouter();

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-700 dark:text-cyan-300">
            Capture Hub
          </p>
          <h1 className="text-2xl font-bold text-[var(--foreground)]">{title}</h1>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-[var(--muted-foreground)]">
            {description}
          </p>
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>

      <nav
        className="flex gap-1 overflow-x-auto rounded-xl border border-[var(--border)] bg-[var(--card)] p-1"
        aria-label="Capture Hub"
      >
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const active = tab.exact
            ? router.pathname === tab.href || router.pathname.startsWith('/capture/messages/')
            : router.pathname.startsWith(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`inline-flex min-w-fit flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition ${
                active
                  ? 'bg-cyan-600 text-white shadow-sm'
                  : 'text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)]'
              }`}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </Link>
          );
        })}
      </nav>

      {children}
    </div>
  );
}
