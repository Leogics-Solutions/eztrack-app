'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { AppLayout } from '@/components/layout';
import { AutomationRunReview } from '../agents/runs/[runId]';
import { getRun, type AgentRun } from '@/services/AgentsService';

function isOutsourcedOrder(run: AgentRun) {
  if (run.review_schema?.template_key === 'payment_knock_off') return false;
  const data = run.corrected_data || run.extracted_data;
  const route = String(data?.fulfilment_route || data?.issuing_entity?.route || data?.issuing_entity?.fulfilment_mode || '').toUpperCase();
  return route === 'OUTSOURCED';
}

export default function ReviewItemPage() {
  const router = useRouter();
  const runId = Number(router.query.runId);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!runId) return;
    let active = true;
    getRun(runId)
      .then((run) => {
        if (!active) return;
        if (isOutsourcedOrder(run)) {
          const query = { ...router.query };
          delete query.runId;
          void router.replace({ pathname: `/review/outsourced/${run.id}`, query });
          return;
        }
        setReady(true);
      })
      .catch(() => {
        if (active) setReady(true);
      });
    return () => { active = false; };
  }, [runId, router]);

  if (!ready) {
    return (
      <AppLayout pageName="Review">
        <p className="text-sm text-[var(--muted-foreground)]">Loading…</p>
      </AppLayout>
    );
  }

  return <AutomationRunReview reviewMode />;
}
