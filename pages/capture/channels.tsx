'use client';

import { CaptureShell } from '@/components/capture/CaptureShell';
import { AppLayout } from '@/components/layout';
import { useOrganization } from '@/lib/OrganizationContext';
import {
  createIntegrationSetupRequest,
  listChannelSyncSchedules,
  listIntegrationSetupRequests,
  updateChannelSyncSchedule,
  type ChannelSyncSchedule,
  type ChannelSyncType,
  type IntegrationRequestChannel,
  type IntegrationSetupRequest,
} from '@/services/CaptureService';
import {
  deleteDriveConnection,
  getDriveConnect,
  getDriveFolderWatches,
  replaceDriveFolderWatches,
  postDriveCallback,
  postDriveSync,
  type DriveFolderWatch,
} from '@/services/DriveService';
import {
  deleteGmailConnection,
  getGmailConnect,
  postGmailCallback,
  postGmailSync,
} from '@/services/GmailService';
import { getSettings, type SettingsResponse } from '@/services/SettingsService';
import {
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  Clock3,
  FolderOpen,
  Link2,
  Mail,
  MessageCircle,
  Plus,
  RefreshCw,
  Save,
  Send,
  Smartphone,
  Trash2,
  Unplug,
  Upload,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useCallback, useEffect, useRef, useState } from 'react';

type ChannelStatus = 'connected' | 'available' | 'assisted' | 'disabled';

type DriveFolderDraft = {
  key: string;
  id?: number;
  connection_id: number;
  name: string;
  folder_id: string;
};

type SyncScheduleDraft = {
  enabled: boolean;
  interval_minutes: 5 | 15 | 30 | 60;
  gmail_only_unread: boolean;
};

function StatusPill({ status }: { status: ChannelStatus }) {
  const styles = {
    connected: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200',
    available: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-950 dark:text-cyan-200',
    assisted: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200',
    disabled: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200',
  };
  const labels: Record<ChannelStatus, string> = {
    connected: 'connected',
    available: 'ready',
    assisted: 'assisted setup',
    disabled: 'disabled',
  };
  return <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${styles[status]}`}>{labels[status]}</span>;
}

function ChannelCard({
  icon,
  title,
  description,
  status,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  status: ChannelStatus;
  children: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)]">
      <div className="flex items-start justify-between gap-4 border-b border-[var(--border)] p-5">
        <div className="flex gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-700 dark:text-cyan-300">
            {icon}
          </div>
          <div>
            <h2 className="font-semibold">{title}</h2>
            <p className="mt-1 text-sm leading-6 text-[var(--muted-foreground)]">{description}</p>
          </div>
        </div>
        <StatusPill status={status} />
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

function AutoSyncPanel({
  channelType,
  schedule,
  draft,
  busy,
  onChange,
  onSave,
}: {
  channelType: ChannelSyncType;
  schedule?: ChannelSyncSchedule;
  draft: SyncScheduleDraft;
  busy: boolean;
  onChange: (patch: Partial<SyncScheduleDraft>) => void;
  onSave: () => void;
}) {
  return (
    <div className="rounded-lg bg-[var(--muted)] p-3">
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-xs font-medium">
          <input
            type="checkbox"
            checked={draft.enabled}
            onChange={(event) => onChange({ enabled: event.target.checked })}
            className="h-4 w-4 rounded border-[var(--border)] text-cyan-600"
          />
          Auto-sync
        </label>
        <label className="flex items-center gap-2 text-xs text-[var(--muted-foreground)]">
          Every
          <select
            value={draft.interval_minutes}
            onChange={(event) => onChange({
              interval_minutes: Number(event.target.value) as 5 | 15 | 30 | 60,
            })}
            disabled={!draft.enabled}
            className="rounded-md border border-[var(--border)] bg-[var(--card)] px-2 py-1.5 text-xs text-[var(--foreground)] disabled:opacity-50"
          >
            <option value={5}>5 minutes</option>
            <option value={15}>15 minutes</option>
            <option value={30}>30 minutes</option>
            <option value={60}>60 minutes</option>
          </select>
        </label>
        {channelType === 'GMAIL' && (
          <label className="flex items-center gap-2 text-xs text-[var(--muted-foreground)]">
            <input
              type="checkbox"
              checked={draft.gmail_only_unread}
              onChange={(event) => onChange({ gmail_only_unread: event.target.checked })}
              disabled={!draft.enabled}
              className="h-4 w-4 rounded border-[var(--border)] text-cyan-600 disabled:opacity-50"
            />
            Unread inbox only
          </label>
        )}
        <button
          type="button"
          onClick={onSave}
          disabled={busy}
          className="ml-auto inline-flex items-center gap-1.5 rounded-md bg-cyan-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-cyan-700 disabled:opacity-50"
        >
          {busy ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
          Save
        </button>
      </div>
      {schedule?.enabled && schedule.next_sync_at && (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-[var(--muted-foreground)]">
          <Clock3 className="h-3.5 w-3.5" />
          Next automatic sync {new Date(schedule.next_sync_at).toLocaleString()}
          {schedule.last_status ? ` · Last run ${schedule.last_status.toLowerCase()}` : ''}
        </p>
      )}
      {schedule?.last_error && (
        <p className="mt-2 text-xs text-red-600 dark:text-red-300">{schedule.last_error}</p>
      )}
    </div>
  );
}

export default function CaptureChannelsPage() {
  const router = useRouter();
  const { selectedOrganizationId } = useOrganization();
  const callbackHandled = useRef(false);
  const [settings, setSettings] = useState<SettingsResponse | null>(null);
  const [driveFolderWatches, setDriveFolderWatches] = useState<DriveFolderWatch[]>([]);
  const [driveFolderDrafts, setDriveFolderDrafts] = useState<DriveFolderDraft[]>([]);
  const [driveFolderModalOpen, setDriveFolderModalOpen] = useState(false);
  const [driveFolderError, setDriveFolderError] = useState<string | null>(null);
  const [integrationRequests, setIntegrationRequests] = useState<IntegrationSetupRequest[]>([]);
  const [syncSchedules, setSyncSchedules] = useState<ChannelSyncSchedule[]>([]);
  const [syncScheduleDrafts, setSyncScheduleDrafts] = useState<Record<string, SyncScheduleDraft>>({});
  const [requestModal, setRequestModal] = useState<{
    channel: IntegrationRequestChannel;
    label: string;
  } | null>(null);
  const [requestNotes, setRequestNotes] = useState('');
  const [submittingRequest, setSubmittingRequest] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [current, requests, schedules] = await Promise.all([
        getSettings(),
        listIntegrationSetupRequests().catch(() => []),
        listChannelSyncSchedules().catch(() => []),
      ]);
      setSettings(current);
      setIntegrationRequests(requests);
      setSyncSchedules(schedules);
      setSyncScheduleDrafts(
        Object.fromEntries(
          schedules.map((schedule) => [
            `${schedule.channel_type}-${schedule.connection_id}`,
            {
              enabled: schedule.enabled,
              interval_minutes: schedule.interval_minutes as 5 | 15 | 30 | 60,
              gmail_only_unread: schedule.gmail_only_unread,
            },
          ])
        )
      );
      if (current.integrations.drive?.enabled) {
        const driveFolders = await getDriveFolderWatches().catch(() => ({ folders: [] }));
        setDriveFolderWatches(driveFolders.folders || []);
      }
    } catch (reason) {
      setNotice({ type: 'error', message: reason instanceof Error ? reason.message : 'Could not load channel settings.' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load, selectedOrganizationId]);

  useEffect(() => {
    if (!router.isReady || callbackHandled.current) return;
    const connectedProvider = router.query.gmail === 'connected'
      ? 'gmail'
      : router.query.drive === 'connected'
        ? 'drive'
        : null;
    if (connectedProvider) {
      callbackHandled.current = true;
      sessionStorage.removeItem('capture_oauth_provider');
      void (async () => {
        await load();
        setNotice({
          type: 'success',
          message: `${connectedProvider === 'drive' ? 'Google Drive' : 'Gmail'} connected.`,
        });
        await router.replace('/capture/channels', undefined, { shallow: true });
      })();
      return;
    }
    const code = typeof router.query.code === 'string' ? router.query.code : null;
    const state = typeof router.query.state === 'string' ? router.query.state : null;
    if (!code || !state || typeof window === 'undefined') return;
    callbackHandled.current = true;
    const provider = sessionStorage.getItem('capture_oauth_provider');
    setBusy(`${provider}-callback`);
    const finish = provider === 'drive'
      ? postDriveCallback({ code, state })
      : postGmailCallback({ code, state });
    finish
      .then(async () => {
        sessionStorage.removeItem('capture_oauth_provider');
        setNotice({ type: 'success', message: `${provider === 'drive' ? 'Google Drive' : 'Gmail'} connected.` });
        await router.replace('/capture/channels', undefined, { shallow: true });
        await load();
      })
      .catch((reason) => {
        setNotice({ type: 'error', message: reason instanceof Error ? reason.message : 'Connection failed.' });
      })
      .finally(() => setBusy(null));
  }, [load, router]);

  const gmail = settings?.integrations.gmail;
  const drive = settings?.integrations.drive;
  const gmailConnections = gmail?.connections?.filter((connection) => connection.is_active) || [];
  const driveConnections = drive?.connections?.filter((connection) => connection.is_active) || [];

  const scheduleFor = (channelType: ChannelSyncType, connectionId: number) =>
    syncSchedules.find(
      (schedule) =>
        schedule.channel_type === channelType
        && schedule.connection_id === connectionId
    );

  const scheduleDraftFor = (
    channelType: ChannelSyncType,
    connectionId: number
  ): SyncScheduleDraft => {
    const key = `${channelType}-${connectionId}`;
    const saved = scheduleFor(channelType, connectionId);
    return syncScheduleDrafts[key] || {
      enabled: saved?.enabled || false,
      interval_minutes: (saved?.interval_minutes || (channelType === 'GMAIL' ? 5 : 15)) as 5 | 15 | 30 | 60,
      gmail_only_unread: saved?.gmail_only_unread || false,
    };
  };

  const updateScheduleDraft = (
    channelType: ChannelSyncType,
    connectionId: number,
    patch: Partial<SyncScheduleDraft>
  ) => {
    const key = `${channelType}-${connectionId}`;
    const saved = scheduleFor(channelType, connectionId);
    const fallback: SyncScheduleDraft = {
      enabled: saved?.enabled || false,
      interval_minutes: (saved?.interval_minutes || (channelType === 'GMAIL' ? 5 : 15)) as 5 | 15 | 30 | 60,
      gmail_only_unread: saved?.gmail_only_unread || false,
    };
    setSyncScheduleDrafts((current) => ({
      ...current,
      [key]: {
        ...(current[key] || fallback),
        ...patch,
      },
    }));
  };

  const saveAutoSync = async (
    channelType: ChannelSyncType,
    connectionId: number
  ) => {
    const draft = scheduleDraftFor(channelType, connectionId);
    const busyKey = `${channelType.toLowerCase()}-schedule-${connectionId}`;
    setBusy(busyKey);
    setNotice(null);
    try {
      const saved = await updateChannelSyncSchedule(channelType, connectionId, {
        enabled: draft.enabled,
        interval_minutes: draft.interval_minutes,
        gmail_label_ids: ['INBOX'],
        gmail_only_unread: channelType === 'GMAIL' && draft.gmail_only_unread,
      });
      setSyncSchedules((current) => [
        ...current.filter((schedule) => schedule.id !== saved.id),
        saved,
      ]);
      setNotice({
        type: 'success',
        message: `${channelType === 'GMAIL' ? 'Gmail' : 'Drive'} auto-sync ${saved.enabled ? 'enabled' : 'disabled'}.`,
      });
    } catch (reason) {
      setNotice({
        type: 'error',
        message: reason instanceof Error ? reason.message : 'Could not save auto-sync settings.',
      });
    } finally {
      setBusy(null);
    }
  };

  const connect = async (provider: 'gmail' | 'drive') => {
    setBusy(`${provider}-connect`);
    setNotice(null);
    try {
      const response = provider === 'gmail'
        ? await getGmailConnect('capture')
        : await getDriveConnect('capture');
      sessionStorage.setItem('capture_oauth_provider', provider);
      window.location.href = response.auth_url;
    } catch (reason) {
      setNotice({ type: 'error', message: reason instanceof Error ? reason.message : 'Could not start connection.' });
      setBusy(null);
    }
  };

  const sync = async (provider: 'gmail' | 'drive', connectionId: number) => {
    setBusy(`${provider}-sync-${connectionId}`);
    setNotice(null);
    try {
      const response = provider === 'gmail'
        ? await postGmailSync({ connection_id: connectionId })
        : await postDriveSync({ connection_id: connectionId });
      const count = response.jobs_enqueued || 0;
      setNotice({ type: 'success', message: `${provider === 'gmail' ? 'Gmail' : 'Drive'} sync completed. ${count} file${count === 1 ? '' : 's'} queued.` });
      await load();
    } catch (reason) {
      setNotice({ type: 'error', message: reason instanceof Error ? reason.message : 'Sync failed.' });
    } finally {
      setBusy(null);
    }
  };

  const disconnect = async (provider: 'gmail' | 'drive', connectionId: number) => {
    if (!window.confirm(`Disconnect this ${provider === 'gmail' ? 'Gmail' : 'Google Drive'} account?`)) return;
    setBusy(`${provider}-disconnect-${connectionId}`);
    try {
      if (provider === 'gmail') await deleteGmailConnection(connectionId);
      else await deleteDriveConnection(connectionId);
      setNotice({ type: 'success', message: 'Channel disconnected.' });
      await load();
    } catch (reason) {
      setNotice({ type: 'error', message: reason instanceof Error ? reason.message : 'Could not disconnect channel.' });
    } finally {
      setBusy(null);
    }
  };

  const saveDriveFolders = async () => {
    setBusy('drive-folders');
    try {
      if (driveFolderDrafts.some((folder) => !folder.name.trim() || !folder.folder_id.trim())) {
        setDriveFolderError('Every Drive folder needs a name and share link or folder ID.');
        return;
      }
      const updated = await replaceDriveFolderWatches(
        driveFolderDrafts.map((folder, index) => ({
          id: folder.id,
          connection_id: folder.connection_id,
          name: folder.name.trim(),
          folder_id: folder.folder_id.trim(),
          sort_order: index,
        }))
      );
      setDriveFolderWatches(updated.folders || []);
      setDriveFolderModalOpen(false);
      setNotice({ type: 'success', message: 'Drive folders saved.' });
      await load();
    } catch (reason) {
      setDriveFolderError(reason instanceof Error ? reason.message : 'Could not save Drive folders.');
    } finally {
      setBusy(null);
    }
  };

  const openDriveFolderModal = () => {
    setDriveFolderDrafts(
      driveFolderWatches.map((folder) => ({
        key: `saved-${folder.id}`,
        id: folder.id,
        connection_id: folder.connection_id,
        name: folder.name,
        folder_id: folder.folder_id,
      }))
    );
    setDriveFolderError(null);
    setDriveFolderModalOpen(true);
  };

  const addDriveFolder = () => {
    const defaultConnectionId = driveConnections[0]?.id;
    if (!defaultConnectionId) {
      setNotice({ type: 'error', message: 'Connect a Google Drive account before adding folders.' });
      return;
    }
    setDriveFolderDrafts((current) => [
      ...current,
      {
        key: `new-${Date.now()}-${current.length}`,
        connection_id: defaultConnectionId,
        name: '',
        folder_id: '',
      },
    ]);
  };

  const updateDriveFolder = (key: string, patch: Partial<DriveFolderDraft>) => {
    setDriveFolderDrafts((current) =>
      current.map((folder) => folder.key === key ? { ...folder, ...patch } : folder)
    );
  };

  const moveDriveFolder = (index: number, direction: -1 | 1) => {
    setDriveFolderDrafts((current) => {
      const target = index + direction;
      if (target < 0 || target >= current.length) return current;
      const reordered = [...current];
      [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
      return reordered;
    });
  };

  const openRequestModal = (
    channel: IntegrationRequestChannel,
    label: string
  ) => {
    const existing = integrationRequests.find((request) => request.channel === channel);
    setRequestNotes(existing?.notes || '');
    setRequestModal({ channel, label });
  };

  const submitIntegrationRequest = async () => {
    if (!requestModal) return;
    setSubmittingRequest(true);
    try {
      const saved = await createIntegrationSetupRequest({
        channel: requestModal.channel,
        notes: requestNotes.trim(),
      });
      setIntegrationRequests((current) => [
        saved,
        ...current.filter((request) => request.id !== saved.id),
      ]);
      setNotice({
        type: 'success',
        message: `${requestModal.label} setup request submitted. Our team will contact you at ${saved.contact_email}.`,
      });
      setRequestModal(null);
      setRequestNotes('');
    } catch (reason) {
      setNotice({
        type: 'error',
        message: reason instanceof Error ? reason.message : 'Could not submit the setup request.',
      });
    } finally {
      setSubmittingRequest(false);
    }
  };

  const requestFor = (channel: IntegrationRequestChannel) =>
    integrationRequests.find((request) => request.channel === channel);
  const dedicatedEmailRequest = requestFor('DEDICATED_EMAIL');
  const whatsappRequest = requestFor('WHATSAPP_BUSINESS');
  const telegramRequest = requestFor('TELEGRAM');

  return (
    <AppLayout pageName="Integrations">
      <CaptureShell
        title="Input channels"
        description="Connect the places where customers send purchase orders and supporting documents. Every connector feeds the same Smart Inbox."
        eyebrow="Integrations"
        showNavigation={false}
        actions={(
          <button type="button" onClick={() => void load()} disabled={loading} className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-medium hover:bg-[var(--muted)] disabled:opacity-50">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh status
          </button>
        )}
      >
        {notice && (
          <div className={`rounded-xl border p-4 text-sm ${notice.type === 'success' ? 'border-emerald-300/60 bg-emerald-50 text-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-100' : 'border-red-300/60 bg-red-50 text-red-900 dark:bg-red-950/30 dark:text-red-100'}`}>
            {notice.message}
          </div>
        )}

        <section className="space-y-3">
          <div>
            <h2 className="font-semibold">Ready to use</h2>
            <p className="mt-1 text-sm text-[var(--muted-foreground)]">Connect and manage these channels directly from your workspace.</p>
          </div>
          <div className="grid gap-5 xl:grid-cols-2">
            <ChannelCard icon={<Upload className="h-5 w-5" />} title="Web & mobile upload" description="Drag-and-drop, file picker and mobile camera uploads." status="connected">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-300"><CheckCircle2 className="h-4 w-4" /> Available to every workspace</div>
                <Link href="/documents/new" className="rounded-lg bg-cyan-600 px-3 py-2 text-sm font-medium text-white hover:bg-cyan-700">Upload now</Link>
              </div>
            </ChannelCard>

          <ChannelCard
            icon={<Mail className="h-5 w-5" />}
            title="Gmail"
            description="Connect a mailbox and import supported attachments from selected Gmail messages."
            status={!gmail?.enabled ? 'disabled' : gmailConnections.length ? 'connected' : 'available'}
          >
            {loading ? <p className="text-sm text-[var(--muted-foreground)]">Loading Gmail status…</p> : !gmail?.enabled ? (
              <p className="text-sm text-[var(--muted-foreground)]">Gmail must be enabled for this account by an administrator.</p>
            ) : gmailConnections.length === 0 ? (
              <button type="button" onClick={() => void connect('gmail')} disabled={busy !== null} className="inline-flex items-center gap-2 rounded-lg bg-cyan-600 px-3 py-2 text-sm font-medium text-white hover:bg-cyan-700 disabled:opacity-50"><Link2 className="h-4 w-4" /> Connect Gmail</button>
            ) : (
              <div className="space-y-3">
                {gmailConnections.map((connection) => {
                  const schedule = scheduleFor('GMAIL', connection.id);
                  const draft = scheduleDraftFor('GMAIL', connection.id);
                  return (
                    <div key={connection.id} className="space-y-3 rounded-xl border border-[var(--border)] p-3">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <div className="flex flex-wrap items-center gap-2"><p className="text-sm font-medium">{connection.email}</p><span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${connection.can_send ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-900'}`}>{connection.can_send ? 'Capture & send' : 'Capture only'}</span></div>
                          <p className="mt-1 text-xs text-[var(--muted-foreground)]">{connection.last_sync_at ? `Last sync ${new Date(connection.last_sync_at).toLocaleString()}` : 'Not synced yet'}</p>
                        </div>
                         <div className="flex gap-2">
                           {!connection.can_send && <button type="button" onClick={() => void connect('gmail')} disabled={busy !== null} className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-2 text-xs font-medium text-white hover:bg-amber-700 disabled:opacity-50"><Link2 className="h-3.5 w-3.5" /> Allow sending</button>}
                           <button type="button" onClick={() => void sync('gmail', connection.id)} disabled={busy !== null} className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-3 py-2 text-xs font-medium hover:bg-[var(--muted)] disabled:opacity-50"><RefreshCw className={`h-3.5 w-3.5 ${busy === `gmail-sync-${connection.id}` ? 'animate-spin' : ''}`} /> Sync now</button>
                          <button type="button" onClick={() => void disconnect('gmail', connection.id)} disabled={busy !== null} className="rounded-lg p-2 text-red-600 hover:bg-red-500/10 disabled:opacity-50" aria-label="Disconnect Gmail"><Unplug className="h-4 w-4" /></button>
                        </div>
                      </div>
                      <AutoSyncPanel
                        channelType="GMAIL"
                        schedule={schedule}
                        draft={draft}
                        busy={busy === `gmail-schedule-${connection.id}`}
                        onChange={(patch) => updateScheduleDraft('GMAIL', connection.id, patch)}
                        onSave={() => void saveAutoSync('GMAIL', connection.id)}
                      />
                    </div>
                  );
                })}
                <button type="button" onClick={() => void connect('gmail')} disabled={busy !== null} className="inline-flex items-center gap-2 rounded-lg border border-cyan-500/40 px-3 py-2 text-sm font-medium text-cyan-700 hover:bg-cyan-500/10 dark:text-cyan-300 disabled:opacity-50"><Link2 className="h-4 w-4" /> Add another Gmail account</button>
              </div>
            )}
          </ChannelCard>

          <ChannelCard
            icon={<FolderOpen className="h-5 w-5" />}
            title="Google Drive"
            description="Import supported files from one or more connected Drive folders."
            status={!drive?.enabled ? 'disabled' : driveConnections.length ? 'connected' : 'available'}
          >
            {loading ? <p className="text-sm text-[var(--muted-foreground)]">Loading Drive status…</p> : !drive?.enabled ? (
              <p className="text-sm text-[var(--muted-foreground)]">Google Drive must be enabled for this account by an administrator.</p>
            ) : driveConnections.length === 0 ? (
              <button type="button" onClick={() => void connect('drive')} disabled={busy !== null} className="inline-flex items-center gap-2 rounded-lg bg-cyan-600 px-3 py-2 text-sm font-medium text-white hover:bg-cyan-700 disabled:opacity-50"><Link2 className="h-4 w-4" /> Connect Drive</button>
            ) : (
              <div className="space-y-4">
                {driveConnections.map((connection) => {
                  const schedule = scheduleFor('DRIVE', connection.id);
                  const draft = scheduleDraftFor('DRIVE', connection.id);
                  const folderCount = driveFolderWatches.filter(
                    (folder) => folder.connection_id === connection.id
                  ).length;
                  return (
                    <div key={connection.id} className="space-y-3 rounded-xl border border-[var(--border)] p-3">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="text-sm font-medium">{connection.email || `Connection ${connection.id}`}</p>
                          <p className="mt-1 text-xs text-[var(--muted-foreground)]">{connection.last_sync_at ? `Last sync ${new Date(connection.last_sync_at).toLocaleString()}` : 'Not synced yet'} · {folderCount} watched folder{folderCount === 1 ? '' : 's'}</p>
                        </div>
                        <div className="flex gap-2">
                          <button type="button" onClick={() => void sync('drive', connection.id)} disabled={busy !== null} className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-3 py-2 text-xs font-medium hover:bg-[var(--muted)] disabled:opacity-50"><RefreshCw className={`h-3.5 w-3.5 ${busy === `drive-sync-${connection.id}` ? 'animate-spin' : ''}`} /> Sync now</button>
                          <button type="button" onClick={() => void disconnect('drive', connection.id)} disabled={busy !== null} className="rounded-lg p-2 text-red-600 hover:bg-red-500/10 disabled:opacity-50" aria-label="Disconnect Drive"><Unplug className="h-4 w-4" /></button>
                        </div>
                      </div>
                      <AutoSyncPanel
                        channelType="DRIVE"
                        schedule={schedule}
                        draft={draft}
                        busy={busy === `drive-schedule-${connection.id}`}
                        onChange={(patch) => updateScheduleDraft('DRIVE', connection.id, patch)}
                        onSave={() => void saveAutoSync('DRIVE', connection.id)}
                      />
                      {folderCount === 0 && (
                        <p className="text-xs text-amber-700 dark:text-amber-300">Add a watched folder before enabling Drive auto-sync.</p>
                      )}
                    </div>
                  );
                })}
                <button type="button" onClick={() => void connect('drive')} disabled={busy !== null} className="inline-flex items-center gap-2 rounded-lg border border-cyan-500/40 px-3 py-2 text-sm font-medium text-cyan-700 hover:bg-cyan-500/10 dark:text-cyan-300 disabled:opacity-50"><Link2 className="h-4 w-4" /> Add another Drive account</button>
                <div className="rounded-xl bg-[var(--muted)] p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-medium">Watched folders</p>
                      <p className="mt-1 text-xs text-[var(--muted-foreground)]">{driveFolderWatches.length} configured folder{driveFolderWatches.length === 1 ? '' : 's'}, processed in the order shown.</p>
                    </div>
                    <button type="button" onClick={openDriveFolderModal} disabled={busy !== null} className="inline-flex items-center justify-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm font-medium hover:bg-cyan-500/10 disabled:opacity-50"><FolderOpen className="h-4 w-4" /> Manage folders</button>
                  </div>
                  {driveFolderWatches.length > 0 && (
                    <ol className="mt-3 space-y-1.5">
                      {driveFolderWatches.map((folder, index) => {
                        const account = driveConnections.find((connection) => connection.id === folder.connection_id);
                        return (
                          <li key={folder.id} className="flex items-center gap-2 text-xs text-[var(--muted-foreground)]">
                            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--card)] font-medium text-[var(--foreground)]">{index + 1}</span>
                            <span className="truncate font-medium text-[var(--foreground)]">{folder.name}</span>
                            <span className="truncate">· {account?.email || `Drive ${folder.connection_id}`}</span>
                          </li>
                        );
                      })}
                    </ol>
                  )}
                </div>
              </div>
            )}
          </ChannelCard>
          </div>
        </section>

        <section className="space-y-3">
          <div>
            <h2 className="font-semibold">Assisted integrations</h2>
            <p className="mt-1 text-sm text-[var(--muted-foreground)]">These channels are available through our implementation team because provider setup and verification are customer-specific.</p>
          </div>
          <div className="grid gap-5 xl:grid-cols-2">
            <ChannelCard icon={<Mail className="h-5 w-5" />} title="Dedicated inbound email" description="A unique Smartdok address that accepts forwarded mail from any email provider." status="assisted">
              <div className="space-y-3">
                <p className="text-sm leading-6 text-[var(--muted-foreground)]">Our team will provision the mailbox, forwarding rules and secure provider delivery for your workspace.</p>
                {dedicatedEmailRequest && <p className="text-xs font-medium text-amber-700 dark:text-amber-300">Request status: {dedicatedEmailRequest.status.replaceAll('_', ' ')}</p>}
                <button type="button" onClick={() => openRequestModal('DEDICATED_EMAIL', 'Dedicated inbound email')} className="inline-flex items-center gap-2 rounded-lg bg-cyan-600 px-3 py-2 text-sm font-medium text-white hover:bg-cyan-700"><Mail className="h-4 w-4" /> {dedicatedEmailRequest ? 'Update request notes' : 'Request setup help'}</button>
              </div>
            </ChannelCard>

            <ChannelCard icon={<MessageCircle className="h-5 w-5" />} title="WhatsApp Business API" description="Receive messages, images and PDFs through a verified official business channel." status="assisted">
              <div className="space-y-3">
                <p className="text-sm leading-6 text-[var(--muted-foreground)]">We will help with Meta business verification, phone-number onboarding and the official webhook connection.</p>
                {whatsappRequest && <p className="text-xs font-medium text-amber-700 dark:text-amber-300">Request status: {whatsappRequest.status.replaceAll('_', ' ')}</p>}
                <button type="button" onClick={() => openRequestModal('WHATSAPP_BUSINESS', 'WhatsApp Business API')} className="inline-flex items-center gap-2 rounded-lg bg-cyan-600 px-3 py-2 text-sm font-medium text-white hover:bg-cyan-700"><Smartphone className="h-4 w-4" /> {whatsappRequest ? 'Update request notes' : 'Request setup help'}</button>
              </div>
            </ChannelCard>

            <ChannelCard icon={<Send className="h-5 w-5" />} title="Telegram" description="Receive messages and files through a Smartdok-connected Telegram bot." status="assisted">
              <div className="space-y-3">
                <p className="flex items-center gap-2 text-sm text-[var(--muted-foreground)]"><Clock3 className="h-4 w-4" /> Our team will confirm the bot and routing requirements with you.</p>
                {telegramRequest && <p className="text-xs font-medium text-amber-700 dark:text-amber-300">Request status: {telegramRequest.status.replaceAll('_', ' ')}</p>}
                <button type="button" onClick={() => openRequestModal('TELEGRAM', 'Telegram bot')} className="inline-flex items-center gap-2 rounded-lg border border-cyan-500/40 px-3 py-2 text-sm font-medium text-cyan-700 hover:bg-cyan-500/10 dark:text-cyan-300"><Send className="h-4 w-4" /> {telegramRequest ? 'Update request notes' : 'Request integration'}</button>
              </div>
            </ChannelCard>
          </div>
        </section>
      </CaptureShell>
      {driveFolderModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4" role="presentation" onMouseDown={() => busy === null && setDriveFolderModalOpen(false)}>
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="drive-folder-modal-title"
            className="max-h-[90vh] w-full max-w-3xl overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-2xl"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 border-b border-[var(--border)] p-5">
              <div>
                <h2 id="drive-folder-modal-title" className="font-semibold">Manage Google Drive folders</h2>
                <p className="mt-1 text-sm leading-6 text-[var(--muted-foreground)]">Give every folder a clear name, assign its connected account and arrange the processing order.</p>
              </div>
              <button type="button" onClick={() => setDriveFolderModalOpen(false)} disabled={busy !== null} className="rounded-lg p-2 text-[var(--muted-foreground)] hover:bg-[var(--muted)] disabled:opacity-50" aria-label="Close Drive folder manager"><X className="h-4 w-4" /></button>
            </div>
            <div className="max-h-[calc(90vh-150px)] overflow-y-auto p-5">
              {driveFolderError && <div className="mb-4 rounded-lg border border-red-300/60 bg-red-50 p-3 text-sm text-red-800 dark:bg-red-950/30 dark:text-red-100">{driveFolderError}</div>}
              {driveFolderDrafts.length === 0 ? (
                <div className="rounded-xl border border-dashed border-[var(--border)] p-8 text-center">
                  <FolderOpen className="mx-auto h-8 w-8 text-cyan-600" />
                  <p className="mt-2 font-medium">No watched folders yet</p>
                  <p className="mt-1 text-sm text-[var(--muted-foreground)]">Add the first folder and paste its Google Drive share link.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {driveFolderDrafts.map((folder, index) => (
                    <div key={folder.key} className="rounded-xl border border-[var(--border)] p-4">
                      <div className="flex items-start gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-cyan-500/10 text-sm font-semibold text-cyan-700 dark:text-cyan-300">{index + 1}</div>
                        <div className="min-w-0 flex-1 space-y-3">
                          <div className="grid gap-3 sm:grid-cols-2">
                            <div>
                              <label className="text-xs font-medium">Folder name</label>
                              <input value={folder.name} onChange={(event) => updateDriveFolder(folder.key, { name: event.target.value })} placeholder="e.g. Customer purchase orders" className="mt-1 w-full rounded-lg border border-[var(--border)] bg-transparent px-3 py-2 text-sm outline-none focus:border-cyan-500" />
                            </div>
                            <div>
                              <label className="text-xs font-medium">Connected Drive account</label>
                              <select value={folder.connection_id} onChange={(event) => updateDriveFolder(folder.key, { connection_id: Number(event.target.value) })} className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm">
                                {driveConnections.map((connection) => <option key={connection.id} value={connection.id}>{connection.email || `Drive connection ${connection.id}`}</option>)}
                              </select>
                            </div>
                          </div>
                          <div>
                            <label className="text-xs font-medium">Folder share link or ID</label>
                            <input value={folder.folder_id} onChange={(event) => updateDriveFolder(folder.key, { folder_id: event.target.value })} placeholder="https://drive.google.com/drive/folders/..." className="mt-1 w-full rounded-lg border border-[var(--border)] bg-transparent px-3 py-2 text-sm outline-none focus:border-cyan-500" />
                          </div>
                        </div>
                        <div className="flex shrink-0 flex-col gap-1">
                          <button type="button" onClick={() => moveDriveFolder(index, -1)} disabled={index === 0} className="rounded-md p-1.5 hover:bg-[var(--muted)] disabled:opacity-30" aria-label={`Move ${folder.name || 'folder'} up`}><ArrowUp className="h-4 w-4" /></button>
                          <button type="button" onClick={() => moveDriveFolder(index, 1)} disabled={index === driveFolderDrafts.length - 1} className="rounded-md p-1.5 hover:bg-[var(--muted)] disabled:opacity-30" aria-label={`Move ${folder.name || 'folder'} down`}><ArrowDown className="h-4 w-4" /></button>
                          <button type="button" onClick={() => setDriveFolderDrafts((current) => current.filter((item) => item.key !== folder.key))} className="rounded-md p-1.5 text-red-600 hover:bg-red-500/10" aria-label={`Remove ${folder.name || 'folder'}`}><Trash2 className="h-4 w-4" /></button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <button type="button" onClick={addDriveFolder} className="mt-4 inline-flex items-center gap-2 rounded-lg border border-cyan-500/40 px-3 py-2 text-sm font-medium text-cyan-700 hover:bg-cyan-500/10 dark:text-cyan-300"><Plus className="h-4 w-4" /> Add folder</button>
              <div className="mt-6 flex justify-end gap-2 border-t border-[var(--border)] pt-4">
                <button type="button" onClick={() => setDriveFolderModalOpen(false)} disabled={busy !== null} className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-medium hover:bg-[var(--muted)] disabled:opacity-50">Cancel</button>
                <button type="button" onClick={() => void saveDriveFolders()} disabled={busy !== null} className="inline-flex items-center gap-2 rounded-lg bg-cyan-600 px-4 py-2 text-sm font-medium text-white hover:bg-cyan-700 disabled:opacity-50">
                  {busy === 'drive-folders' ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  {busy === 'drive-folders' ? 'Saving...' : 'Save folders'}
                </button>
              </div>
            </div>
          </section>
        </div>
      )}
      {requestModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4" role="presentation" onMouseDown={() => !submittingRequest && setRequestModal(null)}>
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="integration-request-title"
            className="w-full max-w-lg rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-2xl"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 border-b border-[var(--border)] p-5">
              <div>
                <h2 id="integration-request-title" className="font-semibold">Request {requestModal.label} setup</h2>
                <p className="mt-1 text-sm leading-6 text-[var(--muted-foreground)]">Submit this request to the Smartdok implementation team. Notes are optional.</p>
              </div>
              <button type="button" onClick={() => setRequestModal(null)} disabled={submittingRequest} className="rounded-lg p-2 text-[var(--muted-foreground)] hover:bg-[var(--muted)] disabled:opacity-50" aria-label="Close request form"><X className="h-4 w-4" /></button>
            </div>
            <div className="p-5">
              <label htmlFor="integration-request-notes" className="text-sm font-medium">Anything our team should know?</label>
              <textarea
                id="integration-request-notes"
                value={requestNotes}
                onChange={(event) => setRequestNotes(event.target.value)}
                maxLength={2000}
                rows={6}
                placeholder="For example: preferred phone number, existing provider account, expected message volume, or the best time to contact you."
                className="mt-2 w-full rounded-xl border border-[var(--border)] bg-transparent p-3 text-sm leading-6 outline-none focus:border-cyan-500"
                autoFocus
              />
              <p className="mt-1 text-right text-xs text-[var(--muted-foreground)]">{requestNotes.length.toLocaleString()} / 2,000</p>
              <div className="mt-5 flex justify-end gap-2">
                <button type="button" onClick={() => setRequestModal(null)} disabled={submittingRequest} className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-medium hover:bg-[var(--muted)] disabled:opacity-50">Cancel</button>
                <button type="button" onClick={() => void submitIntegrationRequest()} disabled={submittingRequest} className="inline-flex items-center gap-2 rounded-lg bg-cyan-600 px-4 py-2 text-sm font-medium text-white hover:bg-cyan-700 disabled:opacity-50">
                  {submittingRequest && <RefreshCw className="h-4 w-4 animate-spin" />}
                  {submittingRequest ? 'Submitting...' : 'Submit request'}
                </button>
              </div>
            </div>
          </section>
        </div>
      )}
    </AppLayout>
  );
}
