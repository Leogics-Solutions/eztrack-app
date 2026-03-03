'use client';

import { AppLayout } from "@/components/layout";
import { useLanguage } from "@/lib/i18n";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { RefreshCw, FileText, Mail, FolderOpen } from "lucide-react";
import {
  listBatchJobs,
  type BatchJobListItem,
} from "@/services/InvoiceService";
import {
  getGmailConnections,
  getGmailSyncLogs,
  type GmailConnectionInfo,
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
  const [totalJobs, setTotalJobs] = useState(0);
  const [isLoadingJobs, setIsLoadingJobs] = useState(true);
  const [connections, setConnections] = useState<GmailConnectionInfo[]>([]);
  const [syncLogsByConn, setSyncLogsByConn] = useState<Record<number, GmailSyncLogEntry[]>>({});
  const [driveConnections, setDriveConnections] = useState<DriveConnectionInfo[]>([]);
  const [driveSyncLogsByConn, setDriveSyncLogsByConn] = useState<Record<number, DriveSyncLogEntry[]>>({});
  const [isLoadingSync, setIsLoadingSync] = useState(true);

  const loadBatchJobs = useCallback(async () => {
    setIsLoadingJobs(true);
    try {
      const resp = await listBatchJobs();
      const data = resp?.data;
      setBatchJobs(data?.jobs ?? []);
      setTotalJobs(data?.total_jobs ?? 0);
    } catch (err) {
      console.error("Failed to load batch jobs", err);
      setBatchJobs([]);
      setTotalJobs(0);
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
    return status;
  };

  const getStatusColor = (status: string) => {
    const s = status.toUpperCase();
    if (s === "SUCCESS") return "var(--green-600, #16a34a)";
    if (s === "FAILED") return "var(--red-600, #dc2626)";
    if (s === "PROCESSING" || s === "RUNNING") return "var(--blue-600, #2563eb)";
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
