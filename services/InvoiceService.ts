/**
 * Invoice Service
 * Simple functions to call invoice-related endpoints
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_URL || 'http://localhost:8000';
const API_VERSION = 'v1';
const BASE_URL = `${API_BASE_URL}/api/${API_VERSION}`;

// Types
export interface InvoiceLineItem {
  id: number;
  line_number?: number;
  description: string;
  quantity: number;
  unit_price: number;
  uom?: string;
  tax_rate?: number;
  line_total: number;
  account_type?: string;
  account_name?: string;
}

export interface Invoice {
  id: number;
  invoice_no: string;
  invoice_date: string;
  vendor_name: string;
  vendor_address?: string;
  vendor_company_reg_no?: string;
  vendor_phone?: string;
  customer_name?: string;
  subtotal: number;
  tax: number;
  total: number;
  currency: string;
  status?: string;
  created_at?: string;
  pages_processed?: number;
  processing_time_seconds?: number;
  lines?: InvoiceLineItem[];
}

export interface UploadInvoiceResponse {
  success: boolean;
  data: Invoice;
  message: string;
}

export interface ListInvoicesParams {
  skip?: number;
  limit?: number;
}

export interface ListInvoicesResponse {
  success: boolean;
  data: Invoice[];
  message: string;
}

export interface GetInvoiceResponse {
  success: boolean;
  data: Invoice;
  message: string;
}

export interface UpdateInvoiceRequest {
  invoice_no?: string;
  invoice_date?: string;
  vendor_name?: string;
  vendor_address?: string;
  vendor_company_reg_no?: string;
  vendor_phone?: string;
  customer_name?: string;
  subtotal?: number;
  tax?: number;
  total?: number;
  currency?: string;
  status?: string;
}

export interface UpdateInvoiceResponse {
  success: boolean;
  data: Partial<Invoice>;
  message: string;
}

export interface DeleteInvoiceResponse {
  success: boolean;
  data: null;
  message: string;
}

export interface AddLineItemRequest {
  description: string;
  quantity: number;
  unit_price: number;
  uom?: string;
  tax_rate?: number;
  line_total: number;
}

export interface AddLineItemResponse {
  success: boolean;
  data: InvoiceLineItem;
  message: string;
}

export interface UpdateLineItemRequest {
  description?: string;
  quantity?: number;
  unit_price?: number;
  uom?: string;
  tax_rate?: number;
  line_total?: number;
}

export interface UpdateLineItemResponse {
  success: boolean;
  data: Partial<InvoiceLineItem>;
  message: string;
}

export interface DeleteLineItemResponse {
  success: boolean;
  data: null;
  message: string;
}

/**
 * Get access token from localStorage
 */
function getAccessToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('access_token');
}

/**
 * Upload and process an invoice file with OCR
 * POST /invoices/upload
 */
export async function uploadInvoice(file: File): Promise<UploadInvoiceResponse> {
  const token = getAccessToken();

  if (!token) {
    throw new Error('No access token found');
  }

  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(`${BASE_URL}/invoices/upload`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.message || error.error || 'Failed to upload invoice');
  }

  return response.json();
}

/**
 * List all invoices for the current user with pagination
 * GET /invoices
 */
export async function listInvoices(params?: ListInvoicesParams): Promise<ListInvoicesResponse> {
  const token = getAccessToken();

  if (!token) {
    throw new Error('No access token found');
  }

  const queryParams = new URLSearchParams();
  if (params?.skip !== undefined) {
    queryParams.append('skip', params.skip.toString());
  }
  if (params?.limit !== undefined) {
    queryParams.append('limit', params.limit.toString());
  }

  const url = `${BASE_URL}/invoices${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.message || error.error || 'Failed to list invoices');
  }

  return response.json();
}

/**
 * Get detailed invoice information including line items
 * GET /invoices/{invoice_id}
 */
export async function getInvoice(invoiceId: number): Promise<GetInvoiceResponse> {
  const token = getAccessToken();

  if (!token) {
    throw new Error('No access token found');
  }

  const response = await fetch(`${BASE_URL}/invoices/${invoiceId}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.message || error.error || 'Failed to get invoice');
  }

  return response.json();
}

/**
 * Update invoice information
 * PUT /invoices/{invoice_id}
 */
export async function updateInvoice(
  invoiceId: number,
  data: UpdateInvoiceRequest
): Promise<UpdateInvoiceResponse> {
  const token = getAccessToken();

  if (!token) {
    throw new Error('No access token found');
  }

  const response = await fetch(`${BASE_URL}/invoices/${invoiceId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.message || error.error || 'Failed to update invoice');
  }

  return response.json();
}

/**
 * Delete an invoice and its associated file
 * DELETE /invoices/{invoice_id}
 */
export async function deleteInvoice(invoiceId: number): Promise<DeleteInvoiceResponse> {
  const token = getAccessToken();

  if (!token) {
    throw new Error('No access token found');
  }

  const response = await fetch(`${BASE_URL}/invoices/${invoiceId}`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.message || error.error || 'Failed to delete invoice');
  }

  return response.json();
}

/**
 * Add a line item to an invoice
 * POST /invoices/{invoice_id}/lines
 */
export async function addLineItem(
  invoiceId: number,
  data: AddLineItemRequest
): Promise<AddLineItemResponse> {
  const token = getAccessToken();

  if (!token) {
    throw new Error('No access token found');
  }

  const response = await fetch(`${BASE_URL}/invoices/${invoiceId}/lines`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.message || error.error || 'Failed to add line item');
  }

  return response.json();
}

/**
 * Update an existing line item
 * PUT /invoices/{invoice_id}/lines/{line_id}
 */
export async function updateLineItem(
  invoiceId: number,
  lineId: number,
  data: UpdateLineItemRequest
): Promise<UpdateLineItemResponse> {
  const token = getAccessToken();

  if (!token) {
    throw new Error('No access token found');
  }

  const response = await fetch(`${BASE_URL}/invoices/${invoiceId}/lines/${lineId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.message || error.error || 'Failed to update line item');
  }

  return response.json();
}

/**
 * Delete a line item from an invoice
 * DELETE /invoices/{invoice_id}/lines/{line_id}
 */
export async function deleteLineItem(
  invoiceId: number,
  lineId: number
): Promise<DeleteLineItemResponse> {
  const token = getAccessToken();

  if (!token) {
    throw new Error('No access token found');
  }

  const response = await fetch(`${BASE_URL}/invoices/${invoiceId}/lines/${lineId}`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.message || error.error || 'Failed to delete line item');
  }

  return response.json();
}

