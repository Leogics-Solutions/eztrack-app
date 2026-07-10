'use client';

import { AppLayout } from "@/components/layout";
import { useLanguage } from "@/lib/i18n";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { RefreshCw, FileText, Mail, FolderOpen, Trash2 } from "lucide-react";
import {
  listBatchJobs,
  type BatchJobListItem,
} from "@/services/InvoiceService";
import {
  deleteGmailHistory,
  getGmailConnections,
  getGmailHistory,
  getGmailSyncLogs,
  type GmailConnectionInfo,
  type GmailHistoryItem,
  type GmailSyncLogEntry,
} from "@/services/GmailService";
import {
  getDriveConnections,
  getDriveSyncLogs,
  type DriveConnectionInfo,
  type DriveSyncLogEntry,
} from "@/services/DriveService";

const JobsPage = () => {
  const { t } = useLanguage();
  const [batchJobs, setBatchJobs] = useState<BatchJobListItem[]>([]);
  const [isLoadingJobs, setIsLoadingJobs] = useState(true);
  const [connections, setConnections] = useState<GmailConnectionInfo[]>([]);
  const [syncLogsByConn, setSyncLogsByConn] = useState<Record<number, GmailSyncLogEntry[]>>({});
  const [gmailHistory, setGmailHistory] = useState<GmailHistoryItem[]>([]);
  const [driveConnections, setDriveConnections] = useState<DriveConnectionInfo[]>([]);
  const [driveSyncLogsByConn, setDriveSyncLogsByConn] = useState<Record<number, DriveSyncLogEntry[]>>({});
  const [isLoadingSync, setIsLoadingSync] = useState(true);
  const [historyCleanupConnectionId, setHistoryCleanupConnectionId] = useState("all");
  const [resetSyncState, setResetSyncState] = useState(false);
  const [includeSyncLogs, setIncludeSyncLogs] = useState(false);
  const [isClearingGmailHistory, setIsClearingGmailHistory] = useState(false);
  const [gmailHistoryCleanupMessage, setGmailHistoryCleanupMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const loadBatchJobs = useCallback(async () => {
    setIsLoadingJobs(true);
    try {
      const resp = await listBatchJobs();
      const data = resp?.data;
      setBatchJobs(data?.jobs ?? []);
    } catch (err) {
      console.error("Failed to load batch jobs", err);
      setBatchJobs([]);
    } finally {
      setIsLoadingJobs(false);
    }
  }, []);

  const loadSyncHistory = useCallback(async () => {
    setIsLoadingSync(true);
    try {
      const [gmailRes, driveRes] = await Promise.all([
        getGmailConnections().catch(() => ({ connections: [] })),
        getDriveConnections().catch(() => ({ connections: [] })),
      ]);
      const gmailActive = (gmailRes.connections ?? []).filter((c) => c.is_active);
      const driveActive = (driveRes.connections ?? []).filter((c) => c.is_active);
      setConnections(gmailActive);
      setDriveConnections(driveActive);

      const gmailLogs: Record<number, GmailSyncLogEntry[]> = {};
      for (const c of gmailActive) {
        try {
          const { logs: entries } = await getGmailSyncLogs(c.id);
          gmailLogs[c.id] = entries ?? [];
        } catch {
          gmailLogs[c.id] = [];
        }
      }
      setSyncLogsByConn(gmailLogs);

      try {
        const historyRes = await getGmailHistory({ limit: 100 });
        setGmailHistory(historyRes.items ?? historyRes.history ?? []);
      } catch {
        setGmailHistory([]);
      }

      const driveLogs: Record<number, DriveSyncLogEntry[]> = {};
      for (const c of driveActive) {
        try {
          const { logs: entries } = await getDriveSyncLogs(c.id);
          driveLogs[c.id] = entries ?? [];
        } catch {
          driveLogs[c.id] = [];
        }
      }
      setDriveSyncLogsByConn(driveLogs);
    } catch {
      setConnections([]);
      setSyncLogsByConn({});
      setGmailHistory([]);
      setDriveConnections([]);
      setDriveSyncLogsByConn({});
    } finally {
      setIsLoadingSync(false);
    }
  }, []);

  useEffect(() => {
    loadBatchJobs();
  }, [loadBatchJobs]);

  useEffect(() => {
    loadSyncHistory();
  }, [loadSyncHistory]);

  const refreshAll = () => {
    loadBatchJobs();
    loadSyncHistory();
  };

  const getStatusLabel = (status: string) => {
    const s = status.toUpperCase();
    if (s === "PENDING") return t.jobs.pending;
    if (s === "PROCESSING" || s === "RUNNING") return t.jobs.processing;
    if (s === "SUCCESS") return t.jobs.success;
    if (s === "FAILED") return t.jobs.failed;
    if (s === "QUEUED") return t.jobs.queued;
    if (s === "SKIPPED") return t.jobs.skipped;
    if (s === "NO_ATTACHMENTS") return t.jobs.noAttachments;
    return status;
  };

  const getStatusColor = (status: string) => {
    const s = status.toUpperCase();
    if (s === "SUCCESS") return "var(--green-600, #16a34a)";
    if (s === "FAILED") return "var(--red-600, #dc2626)";
    if (s === "PROCESSING" || s === "RUNNING" || s === "QUEUED") return "var(--blue-600, #2563eb)";
    return "var(--muted-foreground)";
  };

  const formatDate = (s: string | undefined | null) => {
    if (!s) return "—";
    try {
      return new Date(s).toLocaleString();
    } catch {
      return s;
    }
  };

  const formatConfidence = (value: number | null | undefined) => {
    if (typeof value !== "number") return "-";
    return `${Math.round(value * 100)}%`;
  };

  const formatNullable = (value: string | null | undefined) => value || "-";

  const handleClearGmailHistory = async () => {
    const connectionId =
      historyCleanupConnectionId === "all" ? undefined : Number(historyCleanupConnectionId);
    const selectedConnection = connections.find((conn) => conn.id === connectionId);
    const scopeLabel = selectedConnection
      ? `${t.jobs.connection}: ${selectedConnection.email}`
      : t.jobs.allGmailConnections;

    const extras = [
      resetSyncState ? t.jobs.resetSyncState : null,
      includeSyncLogs ? t.jobs.includeSyncLogs : null,
    ].filter(Boolean);
    const extraText = extras.length > 0 ? `\n${extras.join("\n")}` : "";

    if (!confirm(`${t.jobs.clearEmailHistoryConfirm}\n\n${scopeLabel}${extraText}`)) return;

    setIsClearingGmailHistory(true);
    setGmailHistoryCleanupMessage(null);
    try {
      await deleteGmailHistory({
        connection_id: connectionId,
        reset_sync_state: resetSyncState,
        include_sync_logs: includeSyncLogs,
      });
      setGmailHistoryCleanupMessage({
        type: "success",
        text: t.jobs.clearEmailHistorySuccess,
      });
      await loadSyncHistory();
    } catch (err) {
      const message = err instanceof Error ? err.message : t.jobs.clearEmailHistoryFailed;
      setGmailHistoryCleanupMessage({
        type: "error",
        text: message,
      });
    } finally {
      setIsClearingGmailHistory(false);
    }
  };

  return (
    <AppLayout pageName={t.jobs.title}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold" style={{ color: "var(--foreground)" }}>
              {t.jobs.title}
            </h1>
            <p className="text-sm mt-1" style={{ color: "var(--muted-foreground)" }}>
              {t.jobs.description}
            </p>
          </div>
          <button
            type="button"
            onClick={refreshAll}
            disabled={isLoadingJobs || isLoadingSync}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-md border text-sm font-medium transition-colors disabled:opacity-50"
            style={{ borderColor: "var(--border)", color: "var(--foreground)" }}
          >
            <RefreshCw className={`h-4 w-4 ${(isLoadingJobs || isLoadingSync) ? "animate-spin" : ""}`} />
            {t.jobs.refresh}
          </button>
        </div>

        {/* Batch Jobs */}
        <div
          className="rounded-lg border"
          style={{ background: "var(--card)", borderColor: "var(--border)" }}
        >
          <div className="p-4 border-b flex items-center gap-2" style={{ borderColor: "var(--border)" }}>
            <FileText className="h-5 w-5" style={{ color: "var(--muted-foreground)" }} />
            <div>
              <h2 className="font-medium" style={{ color: "var(--foreground)" }}>
                {t.jobs.batchJobs}
              </h2>
              <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
                {t.jobs.batchJobsDescription}
              </p>
            </div>
          </div>
          <div className="p-4 overflow-x-auto">
            {isLoadingJobs ? (
              <div className="py-8 text-center text-sm" style={{ color: "var(--muted-foreground)" }}>
                {t.jobs.loading}
              </div>
            ) : batchJobs.length === 0 ? (
              <div className="py-8 text-center text-sm" style={{ color: "var(--muted-foreground)" }}>
                {t.jobs.noJobs}
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ color: "var(--muted-foreground)", borderBottom: "1px solid var(--border)" }}>
                    <th className="text-left py-2 px-3 font-medium">{t.jobs.jobId}</th>
                    <th className="text-left py-2 px-3 font-medium">{t.jobs.filename}</th>
                    <th className="text-left py-2 px-3 font-medium">{t.jobs.status}</th>
                    <th className="text-left py-2 px-3 font-medium">{t.jobs.createdAt}</th>
                    <th className="text-left py-2 px-3 font-medium"></th>
                  </tr>
                </thead>
                <tbody>
                  {batchJobs.map((job) => (
                    <tr key={job.id} style={{ borderBottom: "1px solid var(--border)" }}>
                      <td className="py-2 px-3 font-mono text-xs" style={{ color: "var(--foreground)" }}>
                        {String(job.id)}
                      </td>
                      <td className="py-2 px-3" style={{ color: "var(--foreground)" }}>
                        {job.original_filename || "—"}
                      </td>
                      <td className="py-2 px-3">
                        <span
                          className="inline-block px-2 py-0.5 rounded text-xs font-medium"
                          style={{ color: getStatusColor(job.status), backgroundColor: "var(--muted)" }}
                        >
                          {getStatusLabel(job.status)}
                        </span>
                      </td>
                      <td className="py-2 px-3" style={{ color: "var(--muted-foreground)" }}>
                        {formatDate(job.created_at)}
                      </td>
                      <td className="py-2 px-3">
                        {job.status === "SUCCESS" && job.invoice_id && (
                          <Link
                            href={`/documents/${job.invoice_id}`}
                            className="text-sm font-medium"
                            style={{ color: "var(--primary)" }}
                          >
                            {t.jobs.viewDocument}
                          </Link>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Gmail Sync History */}
        <div
          className="rounded-lg border"
          style={{ background: "var(--card)", borderColor: "var(--border)" }}
        >
          <div className="p-4 border-b flex items-center gap-2" style={{ borderColor: "var(--border)" }}>
            <Mail className="h-5 w-5" style={{ color: "var(--muted-foreground)" }} />
            <div>
              <h2 className="font-medium" style={{ color: "var(--foreground)" }}>
                {t.jobs.syncHistory}
              </h2>
              <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
                {t.jobs.syncHistoryDescription}
              </p>
            </div>
          </div>
          <div className="p-4 overflow-x-auto">
            {isLoadingSync ? (
              <div className="py-8 text-center text-sm" style={{ color: "var(--muted-foreground)" }}>
                {t.jobs.loading}
              </div>
            ) : connections.length === 0 ? (
              <div className="py-8 text-center text-sm" style={{ color: "var(--muted-foreground)" }}>
                {t.jobs.noSyncLogs}
              </div>
            ) : (
              <div className="space-y-6">
                {connections.map((conn) => (
                  <div key={conn.id}>
                    <h3 className="text-sm font-medium mb-2" style={{ color: "var(--foreground)" }}>
                      {t.jobs.connection}: {conn.email}
                    </h3>
                    {(!syncLogsByConn[conn.id] || syncLogsByConn[conn.id].length === 0) ? (
                      <p className="text-sm py-4" style={{ color: "var(--muted-foreground)" }}>
                        {t.jobs.noSyncLogs}
                      </p>
                    ) : (
                      <table className="w-full text-sm">
                        <thead>
                          <tr style={{ color: "var(--muted-foreground)", borderBottom: "1px solid var(--border)" }}>
                            <th className="text-left py-2 px-3 font-medium">{t.jobs.status}</th>
                            <th className="text-left py-2 px-3 font-medium">{t.jobs.messagesClassified}</th>
                            <th className="text-left py-2 px-3 font-medium">{t.jobs.messagesSkipped}</th>
                            <th className="text-left py-2 px-3 font-medium">{t.jobs.messagesProcessed}</th>
                            <th className="text-left py-2 px-3 font-medium">{t.jobs.attachmentsIngested}</th>
                            <th className="text-left py-2 px-3 font-medium">{t.jobs.jobsEnqueued}</th>
                            <th className="text-left py-2 px-3 font-medium">{t.jobs.createdAt}</th>
                            <th className="text-left py-2 px-3 font-medium">{t.jobs.completedAt}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {syncLogsByConn[conn.id].map((log, idx) => (
                            <tr key={log.id ?? idx} style={{ borderBottom: "1px solid var(--border)" }}>
                              <td className="py-2 px-3">
                                <span
                                  className="inline-block px-2 py-0.5 rounded text-xs font-medium"
                                  style={{ color: getStatusColor(log.status ?? ""), backgroundColor: "var(--muted)" }}
                                >
                                  {getStatusLabel(log.status ?? "")}
                                </span>
                              </td>
                              <td className="py-2 px-3" style={{ color: "var(--foreground)" }}>
                                {log.messages_classified ?? "-"}
                              </td>
                              <td className="py-2 px-3" style={{ color: "var(--foreground)" }}>
                                {log.messages_skipped ?? "-"}
                              </td>
                              <td className="py-2 px-3" style={{ color: "var(--foreground)" }}>
                                {log.messages_processed ?? "—"}
                              </td>
                              <td className="py-2 px-3" style={{ color: "var(--foreground)" }}>
                                {log.attachments_ingested ?? "—"}
                              </td>
                              <td className="py-2 px-3" style={{ color: "var(--foreground)" }}>
                                {log.jobs_enqueued ?? "—"}
                              </td>
                              <td className="py-2 px-3" style={{ color: "var(--muted-foreground)" }}>
                                {formatDate(log.started_at)}
                              </td>
                              <td className="py-2 px-3" style={{ color: "var(--muted-foreground)" }}>
                                {formatDate(log.completed_at)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Gmail Email Ingestion History */}
        <div
          className="rounded-lg border"
          style={{ background: "var(--card)", borderColor: "var(--border)" }}
        >
          <div className="p-4 border-b" style={{ borderColor: "var(--border)" }}>
            <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
              <div className="flex items-center gap-2">
                <Mail className="h-5 w-5" style={{ color: "var(--muted-foreground)" }} />
                <div>
                  <h2 className="font-medium" style={{ color: "var(--foreground)" }}>
                    {t.jobs.emailIngestionHistory}
                  </h2>
                  <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
                    {t.jobs.emailIngestionHistoryDescription}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-medium" style={{ color: "var(--muted-foreground)" }}>
                  {t.jobs.clearHistoryForTesting}
                </span>
                <select
                  value={historyCleanupConnectionId}
                  onChange={(event) => setHistoryCleanupConnectionId(event.target.value)}
                  disabled={isClearingGmailHistory}
                  className="h-9 rounded-md border px-3 text-sm disabled:opacity-50"
                  style={{
                    background: "var(--background)",
                    borderColor: "var(--border)",
                    color: "var(--foreground)",
                  }}
                  aria-label={t.jobs.connectionScope}
                >
                  <option value="all">{t.jobs.allGmailConnections}</option>
                  {connections.map((conn) => (
                    <option key={conn.id} value={conn.id}>
                      {conn.email}
                    </option>
                  ))}
                </select>
                <label className="inline-flex h-9 items-center gap-2 text-sm" style={{ color: "var(--foreground)" }}>
                  <input
                    type="checkbox"
                    checked={resetSyncState}
                    onChange={(event) => setResetSyncState(event.target.checked)}
                    disabled={isClearingGmailHistory}
                    className="h-4 w-4"
                  />
                  {t.jobs.resetSyncState}
                </label>
                <label className="inline-flex h-9 items-center gap-2 text-sm" style={{ color: "var(--foreground)" }}>
                  <input
                    type="checkbox"
                    checked={includeSyncLogs}
                    onChange={(event) => setIncludeSyncLogs(event.target.checked)}
                    disabled={isClearingGmailHistory}
                    className="h-4 w-4"
                  />
                  {t.jobs.includeSyncLogs}
                </label>
                <button
                  type="button"
                  onClick={handleClearGmailHistory}
                  disabled={isClearingGmailHistory || isLoadingSync}
                  className="inline-flex h-9 items-center gap-2 rounded-md border px-3 text-sm font-medium transition-colors disabled:opacity-50"
                  style={{
                    borderColor: "var(--border)",
                    color: "var(--red-600, #dc2626)",
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                  {isClearingGmailHistory ? t.jobs.clearingEmailHistory : t.jobs.clearEmailHistory}
                </button>
              </div>
            </div>
            {gmailHistoryCleanupMessage && (
              <p
                className="mt-3 text-sm"
                style={{
                  color:
                    gmailHistoryCleanupMessage.type === "success"
                      ? "var(--green-600, #16a34a)"
                      : "var(--red-600, #dc2626)",
                }}
              >
                {gmailHistoryCleanupMessage.text}
              </p>
            )}
          </div>
          <div className="p-4 overflow-x-auto">
            {isLoadingSync ? (
              <div className="py-8 text-center text-sm" style={{ color: "var(--muted-foreground)" }}>
                {t.jobs.loading}
              </div>
            ) : gmailHistory.length === 0 ? (
              <div className="py-8 text-center text-sm" style={{ color: "var(--muted-foreground)" }}>
                {t.jobs.noEmailHistory}
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ color: "var(--muted-foreground)", borderBottom: "1px solid var(--border)" }}>
                    <th className="text-left py-2 px-3 font-medium">{t.jobs.receivedAt}</th>
                    <th className="text-left py-2 px-3 font-medium">{t.jobs.from}</th>
                    <th className="text-left py-2 px-3 font-medium">{t.jobs.subject}</th>
                    <th className="text-left py-2 px-3 font-medium">{t.jobs.classification}</th>
                    <th className="text-left py-2 px-3 font-medium">{t.jobs.confidence}</th>
                    <th className="text-left py-2 px-3 font-medium">{t.jobs.status}</th>
                    <th className="text-left py-2 px-3 font-medium">{t.jobs.attachments}</th>
                    <th className="text-left py-2 px-3 font-medium">{t.jobs.jobsEnqueued}</th>
                    <th className="text-left py-2 px-3 font-medium">{t.jobs.ingestDecision}</th>
                  </tr>
                </thead>
                <tbody>
                  {gmailHistory.map((item) => (
                    <tr key={item.id} style={{ borderBottom: "1px solid var(--border)" }}>
                      <td className="py-2 px-3 whitespace-nowrap" style={{ color: "var(--muted-foreground)" }}>
                        {formatDate(item.internal_date ?? item.processed_at ?? item.last_seen_at)}
                      </td>
                      <td className="py-2 px-3 max-w-[220px] truncate" style={{ color: "var(--foreground)" }}>
                        {formatNullable(item.from_email)}
                      </td>
                      <td className="py-2 px-3 min-w-[220px] max-w-[360px]" style={{ color: "var(--foreground)" }}>
                        <div className="truncate">{formatNullable(item.subject)}</div>
                        {item.snippet && (
                          <div className="truncate text-xs mt-1" style={{ color: "var(--muted-foreground)" }}>
                            {item.snippet}
                          </div>
                        )}
                      </td>
                      <td className="py-2 px-3" style={{ color: "var(--foreground)" }}>
                        {formatNullable(item.classification_label)}
                      </td>
                      <td className="py-2 px-3" style={{ color: "var(--foreground)" }}>
                        {formatConfidence(item.classification_confidence)}
                      </td>
                      <td className="py-2 px-3">
                        <span
                          className="inline-block px-2 py-0.5 rounded text-xs font-medium"
                          style={{ color: getStatusColor(item.status), backgroundColor: "var(--muted)" }}
                        >
                          {getStatusLabel(item.status)}
                        </span>
                        {item.error_message && (
                          <div className="text-xs mt-1" style={{ color: "var(--red-600, #dc2626)" }}>
                            {item.error_message}
                          </div>
                        )}
                      </td>
                      <td className="py-2 px-3 whitespace-nowrap" style={{ color: "var(--foreground)" }}>
                        {item.eligible_attachments_count ?? 0}/{item.attachments_count ?? 0}
                      </td>
                      <td className="py-2 px-3" style={{ color: "var(--foreground)" }}>
                        {item.jobs_enqueued ?? 0}
                      </td>
                      <td className="py-2 px-3 max-w-[260px] truncate" style={{ color: "var(--muted-foreground)" }}>
                        {formatNullable(item.ingest_decision)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Drive Sync History */}
        <div
          className="rounded-lg border"
          style={{ background: "var(--card)", borderColor: "var(--border)" }}
        >
          <div className="p-4 border-b flex items-center gap-2" style={{ borderColor: "var(--border)" }}>
            <FolderOpen className="h-5 w-5" style={{ color: "var(--muted-foreground)" }} />
            <div>
              <h2 className="font-medium" style={{ color: "var(--foreground)" }}>
                {t.jobs.driveSyncHistory}
              </h2>
              <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
                {t.jobs.driveSyncHistoryDescription}
              </p>
            </div>
          </div>
          <div className="p-4 overflow-x-auto">
            {isLoadingSync ? (
              <div className="py-8 text-center text-sm" style={{ color: "var(--muted-foreground)" }}>
                {t.jobs.loading}
              </div>
            ) : driveConnections.length === 0 ? (
              <div className="py-8 text-center text-sm" style={{ color: "var(--muted-foreground)" }}>
                {t.jobs.noSyncLogs}
              </div>
            ) : (
              <div className="space-y-6">
                {driveConnections.map((conn) => (
                  <div key={conn.id}>
                    <h3 className="text-sm font-medium mb-2" style={{ color: "var(--foreground)" }}>
                      {t.jobs.connection}: {conn.email || `Connection ${conn.id}`}
                    </h3>
                    {(!driveSyncLogsByConn[conn.id] || driveSyncLogsByConn[conn.id].length === 0) ? (
                      <p className="text-sm py-4" style={{ color: "var(--muted-foreground)" }}>
                        {t.jobs.noSyncLogs}
                      </p>
                    ) : (
                      <table className="w-full text-sm">
                        <thead>
                          <tr style={{ color: "var(--muted-foreground)", borderBottom: "1px solid var(--border)" }}>
                            <th className="text-left py-2 px-3 font-medium">{t.jobs.status}</th>
                            <th className="text-left py-2 px-3 font-medium">{t.jobs.filesProcessed}</th>
                            <th className="text-left py-2 px-3 font-medium">{t.jobs.attachmentsIngested}</th>
                            <th className="text-left py-2 px-3 font-medium">{t.jobs.jobsEnqueued}</th>
                            <th className="text-left py-2 px-3 font-medium">{t.jobs.createdAt}</th>
                            <th className="text-left py-2 px-3 font-medium">{t.jobs.completedAt}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {driveSyncLogsByConn[conn.id].map((log, idx) => (
                            <tr key={log.id ?? idx} style={{ borderBottom: "1px solid var(--border)" }}>
                              <td className="py-2 px-3">
                                <span
                                  className="inline-block px-2 py-0.5 rounded text-xs font-medium"
                                  style={{ color: getStatusColor(log.status ?? ""), backgroundColor: "var(--muted)" }}
                                >
                                  {getStatusLabel(log.status ?? "")}
                                </span>
                              </td>
                              <td className="py-2 px-3" style={{ color: "var(--foreground)" }}>
                                {log.files_processed ?? "—"}
                              </td>
                              <td className="py-2 px-3" style={{ color: "var(--foreground)" }}>
                                {log.files_ingested ?? "—"}
                              </td>
                              <td className="py-2 px-3" style={{ color: "var(--foreground)" }}>
                                {log.jobs_enqueued ?? "—"}
                              </td>
                              <td className="py-2 px-3" style={{ color: "var(--muted-foreground)" }}>
                                {formatDate(log.started_at)}
                              </td>
                              <td className="py-2 px-3" style={{ color: "var(--muted-foreground)" }}>
                                {formatDate(log.completed_at)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default JobsPage;
