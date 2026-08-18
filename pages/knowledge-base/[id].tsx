"use client";

import { AppLayout } from "@/components/layout";
import {
  downloadKnowledgeSource,
  getKnowledgeSource,
  updateKnowledgeEntityRoute,
  type KnowledgeSource,
} from "@/services/KnowledgeBaseService";
import {
  listWhatsAppConnections,
  listWhatsAppGroups,
  type WhatsAppConnection,
  type WhatsAppGroup,
} from "@/services/WhatsAppService";
import {
  ArrowLeft,
  Building2,
  Database,
  Download,
  FileText,
  LoaderCircle,
  Pencil,
  Search,
  X,
} from "lucide-react";
import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";

type EntityProfile = {
  key?: string;
  legal_name?: string;
  aliases?: string[];
  role?: string;
  fulfilment_mode?: string;
  outsource_provider?: string;
  outsource_provider_key?: string;
  outbound_channel?: string;
  whatsapp_group_name?: string;
  whatsapp_group_jid?: string;
  whatsapp_connection_id?: number;
  route_inherited?: boolean;
  email_to?: string[];
  email_cc?: string[];
};

type ProviderProfile = Pick<
  EntityProfile,
  | "outbound_channel"
  | "whatsapp_group_name"
  | "whatsapp_group_jid"
  | "whatsapp_connection_id"
  | "email_to"
  | "email_cc"
> & {
  key?: string;
  default_email_to?: string[];
  default_email_cc?: string[];
};

type RouteDraft = {
  mode: "INHERIT" | "EMAIL" | "WHATSAPP" | "MANUAL_HANDOFF";
  emailTo: string;
  emailCc: string;
  connectionId: number;
  groupJid: string;
  groupName: string;
};

const human = (value?: string | null) =>
  value ? value.replaceAll("_", " ").toLowerCase() : "—";
const size = (bytes: number) =>
  bytes < 1024 * 1024
    ? `${(bytes / 1024).toFixed(1)} KB`
    : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;

export default function KnowledgeSourceDetailPage() {
  const router = useRouter();
  const id = Number(router.query.id);
  const [source, setSource] = useState<KnowledgeSource | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [route, setRoute] = useState("ALL");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [editing, setEditing] = useState<EntityProfile | null>(null);
  const [draft, setDraft] = useState<RouteDraft | null>(null);
  const [connections, setConnections] = useState<WhatsAppConnection[]>([]);
  const [groups, setGroups] = useState<WhatsAppGroup[]>([]);
  const [routeBusy, setRouteBusy] = useState(false);

  useEffect(() => {
    if (!Number.isInteger(id) || id <= 0) return;
    let active = true;
    setLoading(true);
    getKnowledgeSource(id)
      .then((result) => {
        if (!active) return;
        setSource(result);
        setError(null);
        if (
          result.reference_type === "DOCUMENT_TEMPLATE" &&
          result.status === "STORED"
        ) {
          downloadKnowledgeSource(id)
            .then((url) => active && setPreviewUrl(url))
            .catch(() => undefined);
        }
      })
      .catch(
        (reason) =>
          active &&
          setError(
            reason instanceof Error
              ? reason.message
              : "Could not load this knowledge source.",
          ),
      )
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [id]);

  const entities = useMemo(() => {
    const providers = new Map(
      ((source?.metadata_json?.providers || []) as ProviderProfile[]).map(
        (provider) => [provider.key, provider],
      ),
    );
    return ((source?.metadata_json?.entities || []) as EntityProfile[]).map(
      (entity) => {
        const provider = providers.get(entity.outsource_provider_key);
        if (!provider) return entity;
        const routeInherited =
          !entity.outbound_channel ||
          entity.outbound_channel === "MANUAL_HANDOFF";
        return {
          ...entity,
          route_inherited: routeInherited,
          outbound_channel: routeInherited
            ? provider.outbound_channel || entity.outbound_channel
            : entity.outbound_channel,
          whatsapp_group_name:
            entity.whatsapp_group_name || provider.whatsapp_group_name,
          whatsapp_group_jid:
            entity.whatsapp_group_jid || provider.whatsapp_group_jid,
          whatsapp_connection_id:
            entity.whatsapp_connection_id || provider.whatsapp_connection_id,
          email_to: entity.email_to?.length
            ? entity.email_to
            : provider.default_email_to,
          email_cc: entity.email_cc?.length
            ? entity.email_cc
            : provider.default_email_cc,
        };
      },
    );
  }, [source]);
  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return entities.filter((entity) => {
      if (route !== "ALL" && entity.fulfilment_mode !== route) return false;
      return (
        !query ||
        [
          entity.legal_name,
          ...(entity.aliases || []),
          entity.outsource_provider,
        ].some((value) =>
          String(value || "")
            .toLowerCase()
            .includes(query),
        )
      );
    });
  }, [entities, route, search]);

  const editRoute = async (entity: EntityProfile) => {
    const connectionId = Number(entity.whatsapp_connection_id || 0);
    setEditing(entity);
    setDraft({
      mode: entity.route_inherited
        ? "INHERIT"
        : entity.outbound_channel === "WHATSAPP"
          ? "WHATSAPP"
          : "EMAIL",
      emailTo: (entity.email_to || []).join(", "),
      emailCc: (entity.email_cc || []).join(", "),
      connectionId,
      groupJid: entity.whatsapp_group_jid || "",
      groupName: entity.whatsapp_group_name || "",
    });
    setGroups([]);
    try {
      const items = await listWhatsAppConnections();
      setConnections(items.filter((item) => item.is_active));
      if (connectionId) setGroups(await listWhatsAppGroups(connectionId));
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Could not load WhatsApp connections.",
      );
    }
  };

  const changeConnection = async (connectionId: number) => {
    setDraft((current) =>
      current
        ? { ...current, connectionId, groupJid: "", groupName: "" }
        : current,
    );
    setGroups([]);
    if (!connectionId) return;
    try {
      setGroups(await listWhatsAppGroups(connectionId));
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Connect this WhatsApp account before selecting a group.",
      );
    }
  };

  const saveRoute = async () => {
    if (!source || !editing?.key || !draft) return;
    setRouteBusy(true);
    try {
      const emails = (value: string) =>
        value
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean);
      const updated = await updateKnowledgeEntityRoute(
        source.id,
        editing.key,
        draft.mode === "INHERIT"
          ? {
              inherit_provider: true,
            }
          : draft.mode === "WHATSAPP"
            ? {
                outbound_channel: "WHATSAPP",
                whatsapp_connection_id: draft.connectionId,
                whatsapp_group_jid: draft.groupJid,
                whatsapp_group_name: draft.groupName,
              }
            : {
                outbound_channel: "EMAIL",
                email_to: emails(draft.emailTo),
                email_cc: emails(draft.emailCc),
              },
      );
      setSource(updated);
      setEditing(null);
      setDraft(null);
      setError(null);
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Could not save this route.",
      );
    } finally {
      setRouteBusy(false);
    }
  };

  const download = async () => {
    if (!source) return;
    try {
      window.open(
        await downloadKnowledgeSource(source.id),
        "_blank",
        "noopener,noreferrer",
      );
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Could not download this source.",
      );
    }
  };

  return (
    <AppLayout pageName="Knowledge detail">
      <button
        type="button"
        onClick={() => router.push("/knowledge-base")}
        className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-slate-700 hover:text-slate-950 dark:text-slate-300 dark:hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Knowledge Base
      </button>
      {loading && (
        <div className="p-12 text-center text-sm text-[var(--muted-foreground)]">
          <LoaderCircle className="mx-auto mb-2 h-5 w-5 animate-spin" />
          Loading company knowledge…
        </div>
      )}
      {error && (
        <div className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm font-medium text-red-900 dark:border-red-800 dark:bg-red-950 dark:text-red-200">
          {error}
        </div>
      )}
      {source && (
        <div className="space-y-5">
          <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 sm:p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-cyan-100 text-cyan-800 dark:bg-cyan-950 dark:text-cyan-200">
                  {source.reference_type === "BUSINESS_ENTITY_REGISTRY" ? (
                    <Building2 className="h-5 w-5" />
                  ) : (
                    <FileText className="h-5 w-5" />
                  )}
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.15em] text-cyan-800 dark:text-cyan-300">
                    {human(source.reference_type)}
                  </p>
                  <h1 className="mt-1 text-2xl font-bold text-[var(--foreground)]">
                    {source.title}
                  </h1>
                  <p className="mt-2 max-w-3xl text-sm text-[var(--muted-foreground)]">
                    {source.description || "No usage instructions provided."}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => void download()}
                disabled={source.status !== "STORED"}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-400 px-4 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-100 disabled:opacity-40 dark:border-slate-600 dark:text-slate-100 dark:hover:bg-slate-800"
              >
                <Download className="h-4 w-4" /> Download original
              </button>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Fact label="Status" value={human(source.status)} />
              <Fact label="Original file" value={source.original_filename} />
              <Fact label="File size" value={size(source.size_bytes)} />
              <Fact
                label="Storage"
                value="Organization-isolated company knowledge"
              />
            </div>
          </section>

          {source.reference_type === "BUSINESS_ENTITY_REGISTRY" && (
            <section className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)]">
              <div className="border-b border-[var(--border)] p-4 sm:p-5">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                  <div>
                    <h2 className="font-semibold text-[var(--foreground)]">
                      Business entities
                    </h2>
                    <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                      {entities.length} aliases and routing profiles extracted
                      from the workbook. These records are used by automations;
                      they are not hard-coded.
                    </p>
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <label className="relative">
                      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                      <input
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        placeholder="Search company or alias"
                        className="w-full rounded-lg border border-[var(--border)] bg-transparent py-2 pl-9 pr-3 text-sm sm:w-64"
                      />
                    </label>
                    <select
                      value={route}
                      onChange={(event) => setRoute(event.target.value)}
                      className="rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm text-[var(--foreground)]"
                    >
                      <option value="ALL">All routes</option>
                      <option value="INTERNAL">Internal</option>
                      <option value="OUTSOURCED">Outsourced</option>
                    </select>
                  </div>
                </div>
              </div>
              <div className="max-h-[620px] overflow-auto">
                <table className="w-full min-w-[980px] text-sm">
                  <thead className="sticky top-0 z-10 bg-slate-100 text-left text-slate-700 dark:bg-slate-900 dark:text-slate-200">
                    <tr>
                      <th className="px-4 py-3">Company</th>
                      <th className="px-4 py-3">Role</th>
                      <th className="px-4 py-3">Route</th>
                      <th className="px-4 py-3">Provider / channel</th>
                      <th className="px-4 py-3">Aliases</th>
                      <th className="px-4 py-3">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((entity, index) => (
                      <tr
                        key={`${entity.key || entity.legal_name}-${index}`}
                        className="border-t border-[var(--border)] align-top"
                      >
                        <td className="px-4 py-3 font-semibold text-[var(--foreground)]">
                          {entity.legal_name || "Unnamed entity"}
                        </td>
                        <td className="px-4 py-3">{human(entity.role)}</td>
                        <td className="px-4 py-3">
                          <span
                            className={`rounded-full px-2 py-1 text-xs font-semibold ${entity.fulfilment_mode === "OUTSOURCED" ? "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-100" : "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100"}`}
                          >
                            {human(entity.fulfilment_mode)}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="block">
                            {entity.outsource_provider ||
                              "Default accounting connection"}
                          </span>
                          {entity.outbound_channel && (
                            <span className="mt-1 block text-xs text-[var(--muted-foreground)]">
                              {human(entity.outbound_channel)}{" "}
                              {entity.whatsapp_group_name ||
                                [
                                  ...(entity.email_to || []),
                                  ...(entity.email_cc || []),
                                ].join(", ")}
                            </span>
                          )}
                          {entity.route_inherited && (
                            <span className="mt-1 block text-[11px] text-cyan-700 dark:text-cyan-300">
                              Inherited from provider
                            </span>
                          )}
                        </td>
                        <td className="max-w-sm px-4 py-3 text-xs text-[var(--muted-foreground)]">
                          {(entity.aliases || []).join(" · ") || "—"}
                        </td>
                        <td className="px-4 py-3">
                          {entity.fulfilment_mode === "OUTSOURCED" && (
                            <button
                              type="button"
                              onClick={() => void editRoute(entity)}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-500 px-3 py-2 text-xs font-semibold text-cyan-800 hover:bg-cyan-50 dark:text-cyan-200 dark:hover:bg-cyan-950"
                            >
                              <Pencil className="h-3.5 w-3.5" /> Edit route
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {filtered.length === 0 && (
                  <p className="p-10 text-center text-sm text-[var(--muted-foreground)]">
                    No matching company profiles.
                  </p>
                )}
              </div>
            </section>
          )}

          {editing && draft && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
              <section
                role="dialog"
                aria-modal="true"
                aria-label="Edit company output route"
                className="w-full max-w-xl rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-2xl"
              >
                <div className="flex items-start justify-between border-b border-[var(--border)] p-5">
                  <div>
                    <h2 className="font-semibold text-[var(--foreground)]">
                      Edit output route
                    </h2>
                    <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                      {editing.legal_name}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEditing(null)}
                    className="rounded-lg p-2 hover:bg-[var(--muted)]"
                    aria-label="Close"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="space-y-4 p-5">
                  <label className="block text-sm font-semibold">
                    Routing method
                    <select
                      value={draft.mode}
                      onChange={(event) =>
                        setDraft({
                          ...draft,
                          mode: event.target.value as RouteDraft["mode"],
                        })
                      }
                      className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2.5 font-normal"
                    >
                      <option value="INHERIT">
                        Inherit from {editing.outsource_provider || "provider"}
                      </option>
                      <option value="EMAIL">Email</option>
                      <option value="WHATSAPP">WhatsApp group</option>
                    </select>
                  </label>
                  {draft.mode === "INHERIT" && (
                    <p className="rounded-xl bg-cyan-50 p-3 text-sm text-cyan-950 dark:bg-cyan-950 dark:text-cyan-100">
                      This company will automatically follow changes made to its
                      provider route.
                    </p>
                  )}
                  {draft.mode === "EMAIL" && (
                    <>
                      <label className="block text-sm font-semibold">
                        To recipients
                        <input
                          value={draft.emailTo}
                          onChange={(event) =>
                            setDraft({ ...draft, emailTo: event.target.value })
                          }
                          placeholder="ops@example.com, accounts@example.com"
                          className="mt-1 w-full rounded-lg border border-[var(--border)] bg-transparent px-3 py-2.5 font-normal"
                        />
                      </label>
                      <label className="block text-sm font-semibold">
                        CC recipients
                        <input
                          value={draft.emailCc}
                          onChange={(event) =>
                            setDraft({ ...draft, emailCc: event.target.value })
                          }
                          placeholder="finance@example.com"
                          className="mt-1 w-full rounded-lg border border-[var(--border)] bg-transparent px-3 py-2.5 font-normal"
                        />
                      </label>
                    </>
                  )}
                  {draft.mode === "WHATSAPP" && (
                    <>
                      <label className="block text-sm font-semibold">
                        WhatsApp connection
                        <select
                          value={draft.connectionId || ""}
                          onChange={(event) =>
                            void changeConnection(Number(event.target.value))
                          }
                          className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2.5 font-normal"
                        >
                          <option value="">Select connected account</option>
                          {connections.map((connection) => (
                            <option key={connection.id} value={connection.id}>
                              {connection.name} · {human(connection.status)}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="block text-sm font-semibold">
                        Destination group
                        <select
                          value={draft.groupJid}
                          disabled={!draft.connectionId}
                          onChange={(event) => {
                            const group = groups.find(
                              (item) => item.jid === event.target.value,
                            );
                            setDraft({
                              ...draft,
                              groupJid: group?.jid || "",
                              groupName: group?.name || "",
                            });
                          }}
                          className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2.5 font-normal disabled:opacity-50"
                        >
                          <option value="">Select group</option>
                          {groups.map((group) => (
                            <option key={group.jid} value={group.jid}>
                              {group.name} · {group.participant_count} members
                            </option>
                          ))}
                        </select>
                      </label>
                      {draft.connectionId > 0 && groups.length === 0 && (
                        <p className="text-xs text-amber-700 dark:text-amber-300">
                          Connect and scan this WhatsApp account first, then
                          reopen the route editor.
                        </p>
                      )}
                    </>
                  )}
                </div>
                <div className="flex justify-end gap-2 border-t border-[var(--border)] p-5">
                  <button
                    type="button"
                    onClick={() => setEditing(null)}
                    className="rounded-lg border border-[var(--border)] px-4 py-2.5 text-sm font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => void saveRoute()}
                    disabled={
                      routeBusy ||
                      (draft.mode === "EMAIL" && !draft.emailTo.trim()) ||
                      (draft.mode === "WHATSAPP" &&
                        (!draft.connectionId || !draft.groupJid))
                    }
                    className="inline-flex items-center gap-2 rounded-lg bg-cyan-700 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    {routeBusy && (
                      <LoaderCircle className="h-4 w-4 animate-spin" />
                    )}{" "}
                    Save route
                  </button>
                </div>
              </section>
            </div>
          )}

          {source.reference_type === "DOCUMENT_TEMPLATE" && (
            <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5">
              <div className="flex items-start gap-3">
                <Database className="mt-0.5 h-5 w-5 text-cyan-700" />
                <div>
                  <h2 className="font-semibold">Template binding</h2>
                  <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                    This is company knowledge. The file is selected only after
                    the automation resolves the matching issuing company.
                  </p>
                </div>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-4">
                <Fact
                  label="Issuing company"
                  value={source.metadata_json?.entity_name || "Not configured"}
                />
                <Fact
                  label="Document type"
                  value={human(source.metadata_json?.document_type)}
                />
                <Fact
                  label="Variant"
                  value={source.metadata_json?.variant || "Default"}
                />
                <Fact
                  label="Usage"
                  value={human(source.metadata_json?.render_mode)}
                />
              </div>
              {previewUrl && source.content_type?.startsWith("image/") && (
                <img
                  src={previewUrl}
                  alt={`Preview of ${source.title}`}
                  className="mt-5 max-h-[720px] w-full rounded-xl border border-[var(--border)] bg-white object-contain"
                />
              )}
              {previewUrl && source.content_type === "application/pdf" && (
                <iframe
                  src={previewUrl}
                  title={`Preview of ${source.title}`}
                  className="mt-5 h-[720px] w-full rounded-xl border border-[var(--border)] bg-white"
                />
              )}
            </section>
          )}
        </div>
      )}
    </AppLayout>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-slate-100 p-3 dark:bg-slate-900">
      <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">
        {label}
      </p>
      <p className="mt-1 break-words text-sm font-medium text-slate-950 dark:text-white">
        {value}
      </p>
    </div>
  );
}
