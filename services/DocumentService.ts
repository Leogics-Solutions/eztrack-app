import { BASE_URL } from './config';

function getAccessToken(): string | null {
  return typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
}

// Document Types and Interfaces
export interface DocumentTypeInfo {
  id: number;
  key: string;
  label: string;
  category: string;
  direction: string;
  priority: string;
  description: string;
}

export interface StructuredFields {
  [key: string]: any;
  // Transfer Note fields
  transfer_note_number?: string;
  date?: string;
  shipped_to?: string;
  company_name?: string;
  items?: Array<{
    description?: string;
    quantity_cartons?: number;
    quantity_pallets?: string;
  }>;
  transporter?: {
    lorry_driver_name?: string;
    ic_number?: string;
    lorry_number?: string;
  };
  // Delivery Order fields
  do_number?: string;
  po_number?: string;
  sender?: string;
  receiver?: string;
  // Weighbridge Ticket fields
  weighbridge_number?: string;
  gross_weight?: number;
  tare_weight?: number;
  net_weight?: number;
  vehicle?: string;
}

export interface ExtractedMetadata {
  source_filename?: string;
  numbers_parsed?: string[];
  type_key?: string;
  extraction_method?: string;
  structured_fields?: StructuredFields;
}

export interface DuplicateDocument {
  id: number;
  reference_number: string;
  document_date: string;
  document_type_key: string;
  created_at: string;
}

export interface Document {
  id: number;
  document_type: DocumentTypeInfo;
  reference_number: string;
  document_date: string;
  category: string;
  direction: string;
  duplicate_count?: number | null;
  duplicate_group_id?: string | null;
  is_duplicate?: boolean;
  amount_total?: number | null;
  weight_kg?: number | null;
  quantity?: number | null;
  filename?: string | null;
  description?: string | null;
  upload_status?: string;
  extracted_metadata?: ExtractedMetadata | null;
  structured_fields?: StructuredFields | null;
  raw_text?: string | null;
  preview_url?: string | null;
  duplicate_documents?: DuplicateDocument[] | null;
  parent_links?: any[] | null;
  child_links?: any[] | null;
  matches?: any[] | null;
  created_at?: string;
  updated_at?: string;
  organization_id?: number;
  user_id?: number;
}

export interface ListDocumentsParams {
  page?: number;
  page_size?: number;
  search?: string;
  direction?: 'AP' | 'AR' | 'NEUTRAL';
  category?: string;
  document_type_key?: string;
  start_date?: string;
  end_date?: string;
  min_amount?: number;
  max_amount?: number;
  upload_status?: string;
}

export interface ListDocumentsData {
  documents: Document[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface ListDocumentsResponse {
  success: boolean;
  data: ListDocumentsData;
  message: string;
}

/**
 * List all documents for the current user with pagination and filters
 * GET /documents/records
 */
export async function listDocuments(
  params?: ListDocumentsParams
): Promise<ListDocumentsResponse> {
  const token = getAccessToken();

  if (!token) {
    throw new Error('No access token found');
  }

  const queryParams = new URLSearchParams();

  if (params?.page !== undefined) {
    queryParams.append('page', params.page.toString());
  }
  if (params?.page_size !== undefined) {
    queryParams.append('page_size', params.page_size.toString());
  }
  if (params?.search) {
    queryParams.append('search', params.search);
  }
  if (params?.direction) {
    queryParams.append('direction', params.direction);
  }
  if (params?.category) {
    queryParams.append('category', params.category);
  }
  if (params?.document_type_key) {
    queryParams.append('document_type_key', params.document_type_key);
  }
  if (params?.start_date) {
    queryParams.append('start_date', params.start_date);
  }
  if (params?.end_date) {
    queryParams.append('end_date', params.end_date);
  }
  if (params?.min_amount !== undefined) {
    queryParams.append('min_amount', params.min_amount.toString());
  }
  if (params?.max_amount !== undefined) {
    queryParams.append('max_amount', params.max_amount.toString());
  }
  if (params?.upload_status) {
    queryParams.append('upload_status', params.upload_status);
  }

  const url = `${BASE_URL}/documents/records${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.message || error.error || 'Failed to list documents');
  }

  return response.json();
}

export interface GetDocumentResponse {
  success: boolean;
  data: Document;
  message: string;
}

/**
 * Get a single document by ID with preview and extracted data
 * GET /documents/records/{document_id}
 */
export async function getDocument(documentId: number): Promise<GetDocumentResponse> {
  const token = getAccessToken();

  if (!token) {
    throw new Error('No access token found');
  }

  const url = `${BASE_URL}/documents/records/${documentId}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.message || error.error || 'Failed to get document');
  }

  return response.json();
}

export interface DeleteDocumentResponse {
  success: boolean;
  message: string;
  data: null;
}

export interface BulkDeleteDocumentsRequest {
  document_ids: number[];
}

export interface BulkDeleteDocumentsData {
  deleted_count: number;
  deleted_ids: number[];
  total_requested: number;
}

export interface BulkDeleteDocumentsResponse {
  success: boolean;
  message: string;
  data: BulkDeleteDocumentsData;
}

/**
 * Delete a single document
 * DELETE /documents/records/{document_id}
 */
export async function deleteDocument(documentId: number): Promise<DeleteDocumentResponse> {
  const token = getAccessToken();

  if (!token) {
    throw new Error('No access token found');
  }

  const url = `${BASE_URL}/documents/records/${documentId}`;

  const response = await fetch(url, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.message || error.error || 'Failed to delete document');
  }

  return response.json();
}

/**
 * Bulk delete multiple documents
 * POST /documents/records/delete-bulk
 */
export async function bulkDeleteDocuments(
  documentIds: number[]
): Promise<BulkDeleteDocumentsResponse> {
  const token = getAccessToken();

  if (!token) {
    throw new Error('No access token found');
  }

  const url = `${BASE_URL}/documents/records/delete-bulk`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({
      document_ids: documentIds,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.message || error.error || 'Failed to delete documents');
  }

  return response.json();
}

export interface UpdateDocumentRequest {
  reference_number?: string;
  document_date?: string;
  amount_total?: number;
  weight_kg?: number;
  quantity?: number;
  description?: string;
  exchange_rate?: number;
  extracted_metadata?: {
    structured_fields?: StructuredFields & {
      exchange_rate?: number;
    };
  };
}

export interface UpdateDocumentResponse {
  success: boolean;
  data: Document;
  message: string;
}

/**
 * Update a document
 * PUT /documents/records/{document_id}
 */
export async function updateDocument(
  documentId: number,
  data: UpdateDocumentRequest
): Promise<UpdateDocumentResponse> {
  const token = getAccessToken();

  if (!token) {
    throw new Error('No access token found');
  }

  const url = `${BASE_URL}/documents/records/${documentId}`;

  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.message || error.error || 'Failed to update document');
  }

  return response.json();
}

