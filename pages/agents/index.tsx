'use client';

import { AppLayout } from '@/components/layout';
import { useLanguage } from '@/lib/i18n';
import { useOrganization } from '@/lib/OrganizationContext';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { Bot, ChevronRight, Plus } from 'lucide-react';
import { listAgents, type Agent } from '@/services/AgentsService';

export default function AgentsListPage() {
  const { t } = useLanguage();
  const { selectedOrganizationId } = useOrganization();
  const router = useRouter();

  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    listAgents()
      .then((res) => { if (active) { setAgents(res.agents); setError(null); } })
      .catch((e) => { if (active) setError(e?.message || 'Failed to load agents'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [selectedOrganizationId]);

  return (
    <AppLayout pageName={t.nav.agents}>
      <div className="bg-white dark:bg-[var(--card)] rounded-lg shadow-sm border border-[var(--border)]">
        <div className="p-6 border-b border-[var(--border)] flex justify-between items-center gap-4">
          <div>
            <h2 className="text-2xl font-bold m-0 flex items-center gap-2">
              <Bot className="h-6 w-6" /> {t.nav.agents}
            </h2>
            <p className="mt-1 text-sm text-[var(--muted-foreground)]">
              Automation agents that capture documents from your channels, extract & prepare them, and act on your approval.
            </p>
          </div>
          <button
            onClick={() => router.push('/agents/new')}
            className="px-4 py-2 bg-[var(--primary)] text-white rounded-md hover:bg-[var(--primary-hover)] transition-colors flex items-center gap-2"
          >
            <Plus className="h-4 w-4" /> New Agent
          </button>
        </div>

        <div className="p-6">
          {loading && <p className="text-[var(--muted-foreground)]">Loading agents…</p>}
          {error && <p className="text-red-600">{error}</p>}
          {!loading && !error && agents.length === 0 && (
            <p className="text-[var(--muted-foreground)]">No agents yet. Create one to start capturing documents from WhatsApp or uploads.</p>
          )}

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {agents.map((a) => (
              <button
                key={a.id}
                onClick={() => router.push(`/agents/${a.id}`)}
                className="text-left rounded-lg border border-[var(--border)] p-4 hover:bg-[var(--hover-bg)] transition-colors"
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold">{a.name}</span>
                  <ChevronRight className="h-4 w-4 text-[var(--muted-foreground)]" />
                </div>
                {a.description && (
                  <p className="mt-1 text-sm text-[var(--muted-foreground)] line-clamp-2">{a.description}</p>
                )}
                <div className="mt-3 flex flex-wrap gap-1">
                  {(a.channels || []).map((c) => (
                    <span key={c.id} className="text-xs rounded-full px-2 py-0.5 bg-[var(--muted)] text-[var(--muted-foreground)]">
                      {c.channel_type}
                    </span>
                  ))}
                  <span className={`text-xs rounded-full px-2 py-0.5 ${a.is_active ? 'bg-green-100 text-green-800' : 'bg-[var(--muted)] text-[var(--muted-foreground)]'}`}>
                    {a.is_active ? 'active' : 'inactive'}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
