import { getScopedHeaders } from "./apiHelpers";
import { BASE_URL } from "./config";

export type KnowledgeReferenceType =
  | "CUSTOMER_MASTER"
  | "PRODUCT_CATALOGUE"
  | "ITEM_ALIASES"
  | "PRICE_LIST"
  | "TAX_CODES"
  | "POLICY"
  | "BUSINESS_ENTITY_REGISTRY"
  | "DOCUMENT_TEMPLATE"
  | "OTHER";

export interface KnowledgeSource {
  id: number;
  organization_id: number;
  title: string;
  description?: string | null;
  reference_type: KnowledgeReferenceType;
  original_filename: string;
  content_type?: string | null;
  size_bytes: number;
  status: "PENDING_UPLOAD" | "STORED" | "FAILED" | string;
  error_message?: string | null;
  indexed_chunks: number;
  metadata_json?: {
    kind?: string;
    entity_name?: string;
    document_type?: "DELIVERY_ORDER" | "SALES_INVOICE" | "QUOTATION";
    variant?: string;
    render_mode?: "REFERENCE_EXAMPLE" | "BACKGROUND";
    entities?: Array<Record<string, unknown>>;
    providers?: Array<Record<string, unknown>>;
    summary?: Record<string, number>;
  } | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface KnowledgeListResponse {
  items: KnowledgeSource[];
  total: number;
  stored: number;
  pending: number;
  failed: number;
}

async function json<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ detail: response.statusText }));
    throw new Error(
      error.detail || error.message || "Knowledge Base request failed.",
    );
  }
  return response.json();
}

export async function listKnowledgeSources(): Promise<KnowledgeListResponse> {
  return json(
    await fetch(`${BASE_URL}/knowledge-base`, { headers: getScopedHeaders() }),
  );
}

export async function getKnowledgeSource(id: number): Promise<KnowledgeSource> {
  return json(
    await fetch(`${BASE_URL}/knowledge-base/${id}`, {
      headers: getScopedHeaders(),
    }),
  );
}

export async function updateKnowledgeEntityRoute(
  sourceId: number,
  entityKey: string,
  route: {
    inherit_provider?: boolean;
    outbound_channel?: "EMAIL" | "WHATSAPP" | "MANUAL_HANDOFF";
    email_to?: string[];
    email_cc?: string[];
    whatsapp_connection_id?: number;
    whatsapp_group_jid?: string;
    whatsapp_group_name?: string;
  },
): Promise<KnowledgeSource> {
  return json(
    await fetch(
      `${BASE_URL}/knowledge-base/${sourceId}/entities/${encodeURIComponent(entityKey)}/route`,
      {
        method: "PATCH",
        headers: getScopedHeaders(),
        body: JSON.stringify(route),
      },
    ),
  );
}

export async function uploadKnowledgeSource(input: {
  file: File;
  title?: string;
  description?: string;
  referenceType: KnowledgeReferenceType;
  entityName?: string;
  documentType?: "DELIVERY_ORDER" | "SALES_INVOICE" | "QUOTATION";
  templateVariant?: string;
  templateRenderMode?: "REFERENCE_EXAMPLE" | "BACKGROUND";
}): Promise<KnowledgeSource> {
  const intent = await json<{ source: KnowledgeSource; upload_url: string }>(
    await fetch(`${BASE_URL}/knowledge-base/upload-intent`, {
      method: "POST",
      headers: getScopedHeaders(),
      body: JSON.stringify({
        filename: input.file.name,
        content_type: input.file.type || "application/octet-stream",
        size_bytes: input.file.size,
        title: input.title?.trim() || undefined,
        description: input.description?.trim() || undefined,
        reference_type: input.referenceType,
        entity_name: input.entityName?.trim() || undefined,
        document_type: input.documentType,
        template_variant: input.templateVariant?.trim() || undefined,
        template_render_mode: input.templateRenderMode || "REFERENCE_EXAMPLE",
      }),
    }),
  );

  const upload = await fetch(intent.upload_url, {
    method: "PUT",
    headers: { "Content-Type": input.file.type || "application/octet-stream" },
    body: input.file,
  });
  if (!upload.ok)
    throw new Error(
      "The file could not be uploaded to storage. Please try again.",
    );

  return json(
    await fetch(`${BASE_URL}/knowledge-base/${intent.source.id}/complete`, {
      method: "POST",
      headers: getScopedHeaders(),
    }),
  );
}

export async function deleteKnowledgeSource(id: number): Promise<void> {
  const response = await fetch(`${BASE_URL}/knowledge-base/${id}`, {
    method: "DELETE",
    headers: getScopedHeaders(),
  });
  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ detail: response.statusText }));
    throw new Error(error.detail || "Could not delete this knowledge source.");
  }
}

export async function downloadKnowledgeSource(id: number): Promise<string> {
  const result = await json<{ download_url: string }>(
    await fetch(`${BASE_URL}/knowledge-base/${id}/download`, {
      headers: getScopedHeaders(),
    }),
  );
  return result.download_url;
}
