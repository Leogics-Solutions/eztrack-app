import { getScopedHeaders } from './apiHelpers';
import { BASE_URL } from './config';

export type AutomationStatus = 'DRAFT' | 'ACTIVE' | 'PAUSED';

export interface AutomationConfig {
  schema_version: number;
  template_key: 'order_to_invoice';
  status: AutomationStatus;
  source: {
    sources: string[];
    whatsapp_mode?: string;
  };
  read: {
    document_type: string;
    required_fields: string[];
    instructions?: string;
  };
  knowledge: {
    required_types: string[];
    notes?: string;
  };
  checks: Record<string, boolean>;
  approval: {
    mode: 'REVIEW_BEFORE_CREATE' | 'AUTO_CREATE_DRAFTS';
  };
  output: {
    destination: string;
    connection_mode?: string;
    create_delivery_order: boolean;
    create_sales_invoice: boolean;
    attach_source_po: boolean;
  };
  test: {
    status: string;
    last_run_at?: string | null;
  };
}

export interface Automation {
  id: number;
  organization_id?: number | null;
  name: string;
  description?: string | null;
  template_key: string;
  record_type: string;
  instructions?: string | null;
  approval_required: boolean;
  status: AutomationStatus;
  config: AutomationConfig;
  channels: Array<{
    id: number;
    channel_type: string;
    channel_ref?: string | null;
    config: Record<string, unknown>;
    is_active: boolean;
  }>;
  outputs: Array<{
    id: number;
    output_type: string;
    sort_order: number;
    config: Record<string, unknown>;
    is_active: boolean;
  }>;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface AutomationListResponse {
  items: Automation[];
  total: number;
  active: number;
  draft: number;
  paused: number;
}

const DEFAULT_CONFIG: AutomationConfig = {
  schema_version: 1,
  template_key: 'order_to_invoice',
  status: 'DRAFT',
  source: { sources: ['UPLOAD'], whatsapp_mode: 'MANAGED_SETUP' },
  read: {
    document_type: 'purchase_order',
    required_fields: ['customer', 'po_number', 'order_date', 'line_items', 'quantity', 'currency'],
    instructions: '',
  },
  knowledge: {
    required_types: ['CUSTOMER_MASTER', 'PRODUCT_CATALOGUE', 'ITEM_ALIASES', 'PRICE_LIST', 'TAX_CODES'],
    notes: '',
  },
  checks: {
    customer_match: true,
    item_match: true,
    duplicate_po: true,
    price_check: true,
    tax_totals: true,
    stock_check: false,
    credit_limit_check: false,
  },
  approval: { mode: 'REVIEW_BEFORE_CREATE' },
  output: {
    destination: 'SQL_ACCOUNT',
    connection_mode: 'MANAGED_SETUP',
    create_delivery_order: true,
    create_sales_invoice: true,
    attach_source_po: true,
  },
  test: { status: 'NOT_RUN', last_run_at: null },
};

function normalizeAutomation(automation: Automation): Automation {
  const config = automation.config || ({} as AutomationConfig);
  const source = { ...DEFAULT_CONFIG.source, ...(config.source || {}) };
  const read = { ...DEFAULT_CONFIG.read, ...(config.read || {}) };
  const knowledge = { ...DEFAULT_CONFIG.knowledge, ...(config.knowledge || {}) };
  return {
    ...automation,
    config: {
      ...DEFAULT_CONFIG,
      ...config,
      source: {
        ...source,
        sources: Array.isArray(source.sources) ? source.sources : DEFAULT_CONFIG.source.sources,
      },
      read: {
        ...read,
        required_fields: Array.isArray(read.required_fields) ? read.required_fields : DEFAULT_CONFIG.read.required_fields,
      },
      knowledge: {
        ...knowledge,
        required_types: Array.isArray(knowledge.required_types) ? knowledge.required_types : DEFAULT_CONFIG.knowledge.required_types,
      },
      checks: { ...DEFAULT_CONFIG.checks, ...(config.checks || {}) },
      approval: { ...DEFAULT_CONFIG.approval, ...(config.approval || {}) },
      output: { ...DEFAULT_CONFIG.output, ...(config.output || {}) },
      test: { ...DEFAULT_CONFIG.test, ...(config.test || {}) },
    },
  };
}

async function handle<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: response.statusText }));
    throw new Error(error.detail || error.message || 'Automation request failed');
  }
  return response.json();
}

export async function listAutomations(): Promise<AutomationListResponse> {
  const result = await handle<AutomationListResponse>(await fetch(`${BASE_URL}/automations`, { headers: getScopedHeaders() }));
  return { ...result, items: result.items.map(normalizeAutomation) };
}

export async function createOrderAutomation(input?: {
  name?: string;
  description?: string;
}): Promise<Automation> {
  return normalizeAutomation(await handle<Automation>(await fetch(`${BASE_URL}/automations`, {
    method: 'POST',
    headers: getScopedHeaders(),
    body: JSON.stringify({
      name: input?.name || 'Customer PO to DO & Invoice',
      description: input?.description || undefined,
      template_key: 'order_to_invoice',
    }),
  })));
}

export async function getAutomation(id: number): Promise<Automation> {
  return normalizeAutomation(await handle<Automation>(await fetch(`${BASE_URL}/automations/${id}`, { headers: getScopedHeaders() })));
}

export async function updateAutomation(
  id: number,
  update: Partial<Pick<Automation, 'name' | 'description' | 'instructions' | 'approval_required' | 'config'>>,
): Promise<Automation> {
  return normalizeAutomation(await handle<Automation>(await fetch(`${BASE_URL}/automations/${id}`, {
    method: 'PATCH',
    headers: getScopedHeaders(),
    body: JSON.stringify(update),
  })));
}

export async function activateAutomation(id: number): Promise<Automation> {
  return normalizeAutomation(await handle<Automation>(await fetch(`${BASE_URL}/automations/${id}/activate`, {
    method: 'POST',
    headers: getScopedHeaders(),
  })));
}

export async function pauseAutomation(id: number): Promise<Automation> {
  return normalizeAutomation(await handle<Automation>(await fetch(`${BASE_URL}/automations/${id}/pause`, {
    method: 'POST',
    headers: getScopedHeaders(),
  })));
}

export async function deleteAutomation(id: number): Promise<void> {
  const response = await fetch(`${BASE_URL}/automations/${id}`, {
    method: 'DELETE',
    headers: getScopedHeaders(),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: response.statusText }));
    throw new Error(error.detail || error.message || 'Could not delete the automation.');
  }
}
