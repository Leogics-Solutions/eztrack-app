'use client';

import Link from 'next/link';
import { useRouter } from 'next/router';
import { Bot, FlaskConical, Inbox } from 'lucide-react';
import { type MouseEvent, useState } from 'react';

const TABS = [
  { href: '/capture', label: 'Inbox', icon: Inbox, exact: true },
  { href: '/capture/rules', label: 'Filtering rules', icon: Bot },
  { href: '/capture/playground', label: 'Playground', icon: FlaskConical },
];

export function CaptureShell({
  title,
  description,
  actions,
  eyebrow = 'Inbox workspace',
  showNavigation = true,
  children,
}: {
  title: string;
  description: string;
  actions?: React.ReactNode;
  eyebrow?: string;
  showNavigation?: boolean;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const isTabActive = (tab: (typeof TABS)[number]) => tab.exact
    ? router.pathname === tab.href || router.pathname.startsWith('/capture/messages/')
    : router.pathname.startsWith(tab.href);
  const activeIndex = Math.max(0, TABS.findIndex(isTabActive));
  const [visualActiveIndex, setVisualActiveIndex] = useState(activeIndex);

  const navigateWithIndicator = (
    event: MouseEvent<HTMLAnchorElement>,
    href: string,
    index: number,
  ) => {
    if (
      event.button !== 0
      || event.metaKey
      || event.ctrlKey
      || event.shiftKey
      || event.altKey
      || href === router.asPath
    ) return;
    event.preventDefault();
    setVisualActiveIndex(index);
    window.setTimeout(() => void router.push(href), 180);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-700 dark:text-cyan-300">
            {eyebrow}
          </p>
          <h1 className="text-2xl font-bold text-[var(--foreground)]">{title}</h1>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-[var(--muted-foreground)]">
            {description}
          </p>
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>

      {showNavigation && <div className="overflow-x-auto rounded-xl">
        <nav
          className="relative grid min-w-[480px] grid-cols-3 rounded-xl border border-[var(--border)] bg-[var(--card)] p-1"
          aria-label="Inbox workspace"
        >
          <span
            aria-hidden="true"
            className="absolute bottom-1 left-1 top-1 rounded-lg bg-cyan-600 shadow-sm transition-transform duration-300 ease-out motion-reduce:transition-none"
            style={{
              width: 'calc((100% - 8px) / 3)',
              transform: `translateX(${visualActiveIndex * 100}%)`,
            }}
          />
          {TABS.map((tab, index) => {
            const Icon = tab.icon;
            const routeActive = isTabActive(tab);
            const active = visualActiveIndex === index;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                onClick={(event) => navigateWithIndicator(event, tab.href, index)}
                aria-current={routeActive ? 'page' : undefined}
                className={`relative z-10 inline-flex min-w-fit items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors duration-300 ${
                  active
                    ? 'text-white'
                    : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
                }`}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </Link>
            );
          })}
        </nav>
      </div>}

      {children}
    </div>
  );
}
