'use client';

import { useRouter } from 'next/router';
import Link from 'next/link';
import { useLanguage } from '@/lib/i18n';
import { useOrganization } from '@/lib/OrganizationContext';
import { Building2, Check, ChevronDown } from 'lucide-react';
import { useRef, useState, useEffect } from 'react';

interface CompanySwitcherProps {
  /** When true, compact display for collapsed sidebar */
  compact?: boolean;
}

export function CompanySwitcher({ compact = false }: CompanySwitcherProps) {
  const { t } = useLanguage();
  const router = useRouter();
  const {
    organizations,
    selectedOrganizationId,
    setSelectedOrganizationId,
    setPrimaryOrganization,
    isLoading,
    error,
  } = useOrganization();
  const [open, setOpen] = useState(false);
  const [settingPrimary, setSettingPrimary] = useState<number | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const current = organizations.find((o) => o.id === selectedOrganizationId);
  const label = current?.name ?? t.organization.noCompany;

  const handleSetPrimary = async (orgId: number) => {
    setSettingPrimary(orgId);
    try {
      await setPrimaryOrganization(orgId);
      setOpen(false);
    } finally {
      setSettingPrimary(null);
    }
  };

  if (isLoading || error) {
    return (
      <div
        className="px-3 py-2 text-xs rounded-lg truncate"
        style={{ color: 'var(--muted-foreground)' }}
      >
        {isLoading ? '...' : error || t.organization.noCompany}
      </div>
    );
  }

  if (organizations.length === 0) {
    return (
      <Link
        href="/settings"
        className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors"
        style={{ color: 'var(--muted-foreground)' }}
        title={t.organization.createCompany}
      >
        <Building2 className="h-4 w-4 flex-shrink-0" />
        {!compact && <span className="truncate">{t.organization.createCompany}</span>}
      </Link>
    );
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors"
        style={{
          background: open ? 'var(--muted)' : 'transparent',
          color: 'var(--foreground)',
        }}
        title={t.organization.switchCompany}
      >
        <Building2 className="h-4 w-4 flex-shrink-0" />
        {!compact && <span className="truncate flex-1">{label}</span>}
        <ChevronDown
          className={`h-4 w-4 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div
          className="absolute left-0 right-0 top-full z-50 mt-1 rounded-lg border py-1 shadow-lg min-w-[180px]"
          style={{
            background: 'var(--card)',
            borderColor: 'var(--border)',
            color: 'var(--card-foreground)',
          }}
        >
          {organizations.map((org) => (
            <div key={org.id}>
              <button
                type="button"
                onClick={() => {
                  setSelectedOrganizationId(org.id);
                  setOpen(false);
                }}
                className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-opacity-80"
                style={{
                  background: selectedOrganizationId === org.id ? 'var(--muted)' : 'transparent',
                }}
              >
                <span className="truncate">{org.name}</span>
                {org.is_primary && (
                  <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                    {t.organization.setAsDefault}
                  </span>
                )}
                {selectedOrganizationId === org.id && (
                  <Check className="h-4 w-4 flex-shrink-0" style={{ color: 'var(--primary)' }} />
                )}
              </button>
              {selectedOrganizationId === org.id && !org.is_primary && (
                <button
                  type="button"
                  onClick={() => handleSetPrimary(org.id)}
                  disabled={settingPrimary !== null}
                  className="w-full px-3 py-1.5 text-left text-xs rounded mx-1"
                  style={{ color: 'var(--muted-foreground)' }}
                >
                  {settingPrimary === org.id ? '...' : t.organization.setAsDefault}
                </button>
              )}
            </div>
          ))}
          <div className="border-t my-1" style={{ borderColor: 'var(--border)' }} />
          <Link
            href="/settings"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-opacity-80"
            style={{ color: 'var(--foreground)' }}
          >
            <Building2 className="h-4 w-4 flex-shrink-0 opacity-70" />
            {t.organization.createCompany}
          </Link>
          <Link
            href="/settings"
            onClick={() => setOpen(false)}
            className="block px-3 py-2 text-sm"
            style={{ color: 'var(--muted-foreground)' }}
          >
            {t.organization.manageCompanies}
          </Link>
        </div>
      )}
    </div>
  );
}
