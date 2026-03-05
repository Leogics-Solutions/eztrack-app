'use client';

import { useRouter } from 'next/router';
import Link from 'next/link';
import { useLanguage } from '@/lib/i18n';
import { useOrganization } from '@/lib/OrganizationContext';
import { Building2, Check, ChevronDown, Search } from 'lucide-react';
import { useRef, useState, useEffect, useMemo } from 'react';

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
  const [searchQuery, setSearchQuery] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const filteredOrganizations = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return organizations;
    return organizations.filter((o) => o.name.toLowerCase().includes(q));
  }, [organizations, searchQuery]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (open) {
      setSearchQuery('');
      setTimeout(() => searchInputRef.current?.focus(), 0);
    }
  }, [open]);

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
          className="absolute left-0 right-0 top-full z-50 mt-1 rounded-lg border shadow-lg min-w-[200px] flex flex-col max-h-[320px]"
          style={{
            background: 'var(--card)',
            borderColor: 'var(--border)',
            color: 'var(--card-foreground)',
          }}
        >
          <div className="p-2 border-b shrink-0" style={{ borderColor: 'var(--border)' }}>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none" style={{ color: 'var(--muted-foreground)' }} />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search companies..."
                className="w-full pl-8 pr-3 py-2 text-sm rounded-md border outline-none focus:ring-2 focus:ring-[var(--primary)]"
                style={{
                  background: 'var(--background)',
                  borderColor: 'var(--border)',
                  color: 'var(--foreground)',
                }}
              />
            </div>
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto py-1">
            {filteredOrganizations.length === 0 ? (
              <div className="px-3 py-4 text-sm text-center" style={{ color: 'var(--muted-foreground)' }}>
                {searchQuery.trim() ? 'No companies match your search.' : 'No companies.'}
              </div>
            ) : (
              filteredOrganizations.map((org) => (
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
                      <span className="text-xs shrink-0" style={{ color: 'var(--muted-foreground)' }}>
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
              ))
            )}
          </div>
          <div className="border-t shrink-0 py-1" style={{ borderColor: 'var(--border)' }}>
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
        </div>
      )}
    </div>
  );
}
