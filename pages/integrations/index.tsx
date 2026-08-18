'use client';

import { AppLayout } from '@/components/layout';
import { useOrganization } from '@/lib/OrganizationContext';
import { getSettings, type SettingsResponse } from '@/services/SettingsService';
import { listWhatsAppConnections } from '@/services/WhatsAppService';
import { listWeChatConnections } from '@/services/WeChatService';
import { listSqlAccountConnections } from '@/services/SqlAccountService';
import { listEmailConnections } from '@/services/EmailConnectionService';
import {
  ArrowRight,
  CheckCircle2,
  Database,
  FolderOpen,
  Link2,
  LoaderCircle,
  Mail,
  MessageCircle,
  RefreshCw,
  Send,
  Settings2,
  Upload,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

interface IntegrationCardProps {
  icon: LucideIcon;
  title: string;
  description: string;
  status: string;
  statusTone?: 'connected' | 'available' | 'assisted';
  href: string;
  action: string;
}

export default function IntegrationsPage() {
  const { selectedOrganizationId } = useOrganization();
  const [settings, setSettings] = useState<SettingsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [whatsappCount, setWhatsappCount] = useState(0);
  const [wechatCount, setWechatCount] = useState(0);
  const [sqlAccountCount, setSqlAccountCount] = useState(0);
  const [emailCount, setEmailCount] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [nextSettings, whatsapp, wechat, sqlAccounts, emailConnections] = await Promise.all([getSettings(), listWhatsAppConnections(), listWeChatConnections(), listSqlAccountConnections(), listEmailConnections()]);
      setSettings(nextSettings);
      setWhatsappCount(whatsapp.length);
      setWechatCount(wechat.length);
      setSqlAccountCount(sqlAccounts.connections.length);
      setEmailCount(emailConnections.length);
      setError(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not load integration status.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load, selectedOrganizationId]);

  const gmailCount = settings?.integrations.gmail?.connection_count || 0;
  const driveCount = settings?.integrations.drive?.connection_count || 0;

  return (
    <AppLayout pageName="Integrations">
      <div className="space-y-7">
        <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-700 dark:text-cyan-300">Connections</p>
            <h1 className="text-2xl font-bold text-[var(--foreground)]">Integrations</h1>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-[var(--muted-foreground)]">
              Manage where work enters Smartdok and where approved outputs are posted. Connections are scoped to the selected company.
            </p>
          </div>
          <button type="button" onClick={() => void load()} disabled={loading} className="inline-flex items-center justify-center gap-2 rounded-lg border border-[var(--border)] px-4 py-2.5 text-sm font-semibold hover:bg-[var(--muted)] disabled:opacity-50">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh status
          </button>
        </header>

        {error && <div role="alert" className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm font-medium text-amber-950 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100">{error}</div>}

        {loading && !settings ? (
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-14 text-center text-sm text-[var(--muted-foreground)]"><LoaderCircle className="mx-auto mb-3 h-6 w-6 animate-spin" />Loading integrations…</div>
        ) : (
          <>
            <IntegrationSection title="Input channels" description="Sources that send messages, documents, and transaction evidence into the Inbox.">
              <IntegrationCard icon={Upload} title="Web & mobile upload" description="Drag-and-drop, file picker, and mobile camera uploads." status="Ready" statusTone="connected" href="/documents/new" action="Upload documents" />
              <IntegrationCard icon={Mail} title="Gmail" description="Import attachments and messages from connected Gmail accounts." status={gmailCount ? `${gmailCount} connected` : 'Available'} statusTone={gmailCount ? 'connected' : 'available'} href="/capture/channels" action="Manage Gmail" />
              <IntegrationCard icon={FolderOpen} title="Google Drive" description="Watch selected folders and import new business documents." status={driveCount ? `${driveCount} connected` : 'Available'} statusTone={driveCount ? 'connected' : 'available'} href="/capture/channels" action="Manage Drive" />
              <IntegrationCard icon={MessageCircle} title="WhatsApp" description="Pair one or more WhatsApp accounts. Automations can reuse their available groups." status={whatsappCount ? `${whatsappCount} configured` : 'Available'} statusTone={whatsappCount ? 'connected' : 'available'} href="/integrations/whatsapp" action="Manage connections" />
              <IntegrationCard icon={MessageCircle} title="WeChat" description="Connect the pinned Windows group runner for payment-slip automations." status={wechatCount ? `${wechatCount} configured` : 'Available'} statusTone={wechatCount ? 'connected' : 'available'} href="/integrations/wechat" action="Manage connections" />
              <IntegrationCard icon={Send} title="Email mailboxes" description="Send outsourced work requests and monitor same-thread replies through Yahoo or another IMAP/SMTP mailbox." status={emailCount ? `${emailCount} connected` : 'Available'} statusTone={emailCount ? 'connected' : 'available'} href="/integrations/email" action="Manage email" />
            </IntegrationSection>

            <IntegrationSection title="Accounting & ERP outputs" description="Destinations used after Smartdok completes checks and obtains the required approval.">
              <IntegrationCard icon={Database} title="SQL Accounting" description="Give approved agents narrow tools for customers, items, delivery orders, invoices and official PDFs." status={sqlAccountCount ? `${sqlAccountCount} connected` : 'Available'} statusTone={sqlAccountCount ? 'connected' : 'available'} href="/integrations/sql-account" action="Manage connections" />
            </IntegrationSection>
          </>
        )}

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-blue-300 bg-blue-50 p-4 text-sm text-blue-950 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-100">
            <p className="font-semibold">Connection versus automation</p>
            <p className="mt-1 leading-6 text-blue-900/80 dark:text-blue-100/80">Integrations establish access. Each Automation decides which source to listen to, what to check, who approves, and which connected destination receives the result.</p>
          </div>
          <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 text-sm">
            <p className="font-semibold text-[var(--foreground)]">Need a company-specific connector?</p>
            <p className="mt-1 leading-6 text-[var(--muted-foreground)]">Use assisted setup for company-specific accounting, ERP, WhatsApp, inventory, or API requirements.</p>
            <Link href="/capture/channels" className="mt-3 inline-flex items-center gap-2 font-semibold text-cyan-700 hover:underline dark:text-cyan-300">View assisted setup <ArrowRight className="h-4 w-4" /></Link>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

function IntegrationSection({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return <section className="space-y-3"><div><h2 className="text-lg font-semibold text-[var(--foreground)]">{title}</h2><p className="mt-1 text-sm text-[var(--muted-foreground)]">{description}</p></div><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{children}</div></section>;
}

function IntegrationCard({ icon: Icon, title, description, status, statusTone = 'available', href, action }: IntegrationCardProps) {
  const tones = {
    connected: 'border-emerald-300 bg-emerald-100 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-100',
    available: 'border-blue-300 bg-blue-100 text-blue-900 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-100',
    assisted: 'border-amber-300 bg-amber-100 text-amber-950 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100',
  };
  return (
    <article className="flex min-h-64 flex-col rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5">
      <div className="flex items-start justify-between gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-700 dark:text-cyan-300"><Icon className="h-5 w-5" /></span><span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${tones[statusTone]}`}>{status}</span></div>
      <h3 className="mt-5 font-semibold text-[var(--foreground)]">{title}</h3>
      <p className="mt-1 flex-1 text-sm leading-6 text-[var(--muted-foreground)]">{description}</p>
      <Link href={href} className="mt-5 inline-flex items-center justify-center gap-2 rounded-lg border border-[var(--border)] px-3 py-2.5 text-sm font-semibold text-[var(--foreground)] hover:border-cyan-500 hover:bg-cyan-500/10">{statusTone === 'connected' ? <CheckCircle2 className="h-4 w-4" /> : statusTone === 'assisted' ? <Settings2 className="h-4 w-4" /> : <Link2 className="h-4 w-4" />}{action}</Link>
    </article>
  );
}
