'use client';

import { AppLayout } from '@/components/layout';
import { AgentChat } from '@/components/agent';
import { useLanguage } from '@/lib/i18n';

export default function SmartdokAgentPage() {
  const { t } = useLanguage();

  return (
    <AppLayout pageName={t.nav.smartdokAgent}>
      <AgentChat />
    </AppLayout>
  );
}
