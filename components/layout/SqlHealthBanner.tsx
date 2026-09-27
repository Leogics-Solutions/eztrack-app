'use client';

import { useEffect, useState } from 'react';
import { useOrganization } from '@/lib/OrganizationContext';
import { getScopedHeaders } from '@/services/apiHelpers';
import { BASE_URL } from '@/services/config';

type Health = { status: string; message: string; checked_at: string; companies: string[] };
type Incident = { id: string; message: string; started_at: string; resolved_at: string | null };

export function SqlHealthBanner() {
  const { selectedOrganizationId } = useOrganization();
  const [items, setItems] = useState<Health[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [downloadError, setDownloadError] = useState('');
  useEffect(() => {
    setItems([]);
    setIncidents([]);
    setDownloadError('');
    if (!selectedOrganizationId) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    const controller = new AbortController();
    async function poll() {
      if (stopped) return;
      try {
        if (document.visibilityState !== 'hidden') {
          const response = await fetch(`${BASE_URL}/sql-account/health-summary`, {
            headers: getScopedHeaders(), signal: controller.signal,
          });
          if (!response.ok) throw new Error('Health check unavailable');
          const body = await response.json();
          if (!stopped) {
            const checks = body.items || [];
            if (body.monitor?.error || body.monitor?.running === false) checks.push({ status: 'UNKNOWN', message: body.monitor?.error || 'Background SQL monitoring is not running.', companies: [], checked_at: '' });
            setItems(checks);
            setIncidents(body.incidents || []);
          }
        }
      } catch {
        if (!stopped) setItems([{ status: 'UNKNOWN', message: 'SQL connection monitoring is unavailable. Refresh to check the latest connection status.', checked_at: '', companies: [] }]);
      } finally {
        if (!stopped) timer = setTimeout(poll, 15000);
      }
    }
    void poll();
    return () => { stopped = true; clearTimeout(timer); controller.abort(); };
  }, [selectedOrganizationId]);
  const warnings = items.filter(item => !['OK', 'BUSY'].includes(item.status));
  async function download(incident: Incident) {
    setDownloadError('');
    try {
      const response = await fetch(`${BASE_URL}/sql-account/health-incidents/${incident.id}`, { headers: getScopedHeaders() });
      if (!response.ok) throw new Error('Download failed. Please try again.');
      const url = URL.createObjectURL(await response.blob());
      const anchor = document.createElement('a');
      anchor.href = url; anchor.download = `SQL-diagnostic-${incident.id}.json`;
      anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch { setDownloadError('Diagnostic download failed. Please try again.'); }
  }
  if (!warnings.length && !incidents.length) return null;
  return <div role={warnings.length ? 'alert' : undefined} className={`shrink-0 border-b px-4 py-3 text-sm ${warnings.length ? 'border-amber-300 bg-amber-50 text-amber-950' : 'border-slate-200 bg-slate-50 text-slate-700'}`}>
    {warnings.map((item, index) => <p key={index}>
      <strong>{item.status === 'SLOW' ? 'SQL is slow. ' : 'SQL connection needs attention. '}</strong>
      {item.message} {item.companies.length > 0 && <span>({item.companies.join(', ')})</span>}
    </p>)}
    {incidents.length > 0 && <details className="mt-1">
      <summary className="cursor-pointer font-medium">SQL diagnostic history ({incidents.length})</summary>
      <div className="max-h-48 overflow-y-auto">{incidents.map(incident => <div key={incident.id} className="mt-2 border-t pt-2">
        <span className="font-medium">{incident.resolved_at ? 'Recovered' : 'Needs attention'}</span>{' · '}
        {new Date(incident.started_at).toLocaleString()} — {incident.message}{' '}
        <button type="button" className="underline" onClick={() => void download(incident)}>Download diagnostic report</button>
      </div>)}</div>
      <p className="mt-2 text-xs">Reports show observed symptoms and recorded steps. The underlying cause may still need investigation.</p>
    </details>}
    {downloadError && <p role="alert">{downloadError}</p>}
  </div>;
}
