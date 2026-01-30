/**
 * Purchase Order Service
 * Handles fetching purchase orders from Business Central
 */

import { BASE_URL } from './config';

function getAccessToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('access_token');
}

// Types
export interface ListPurchaseOrdersParams {
  page?: number;
  page_size?: number;
  search?: string;
  vendor_id?: number;
  vendor_name?: string;
  status?: string;
  start_date?: string;
  end_date?: string;
  connection_id?: number;
}

export interface PurchaseOrder {
  id: string;
  number: string;
  vendor_id?: string;
  vendor_name?: string;
  vendor_number?: string;
  order_date?: string;
  expected_receipt_date?: string;
  status?: string;
  total_amount?: number;
  currency?: string;
  description?: string;
  created_at?: string;
  updated_at?: string;
}

export interface ListPurchaseOrdersResponse {
  success: boolean;
  message?: string;
  data?: PurchaseOrder[];
  total?: number;
  page?: number;
  page_size?: number;
  total_pages?: number;
}

export interface GetPurchaseOrderResponse {
  success: boolean;
  message?: string;
  data?: PurchaseOrder;
}

/**
 * List purchase orders from Business Central
 * GET /business-central/purchase-orders
 */
export async function listPurchaseOrders(
  params?: ListPurchaseOrdersParams
): Promise<ListPurchaseOrdersResponse> {
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
  if (params?.vendor_id !== undefined) {
    queryParams.append('vendor_id', params.vendor_id.toString());
  }
  if (params?.vendor_name) {
    queryParams.append('vendor_name', params.vendor_name);
  }
  if (params?.status) {
    queryParams.append('status', params.status);
  }
  if (params?.start_date) {
    queryParams.append('start_date', params.start_date);
  }
  if (params?.end_date) {
    queryParams.append('end_date', params.end_date);
  }
  if (params?.connection_id !== undefined) {
    queryParams.append('connection_id', params.connection_id.toString());
  }

  const url = `${BASE_URL}/business-central/purchase-orders${
    queryParams.toString() ? `?${queryParams.toString()}` : ''
  }`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.message || error.error || 'Failed to list purchase orders');
  }

  return response.json();
}

/**
 * Get a single purchase order by ID
 * GET /business-central/purchase-orders/{purchase_order_id}
 */
export async function getPurchaseOrder(
  purchaseOrderId: string,
  connectionId?: number
): Promise<GetPurchaseOrderResponse> {
  const token = getAccessToken();

  if (!token) {
    throw new Error('No access token found');
  }

  const queryParams = new URLSearchParams();
  if (connectionId !== undefined) {
    queryParams.append('connection_id', connectionId.toString());
  }

  const url = `${BASE_URL}/business-central/purchase-orders/${purchaseOrderId}${
    queryParams.toString() ? `?${queryParams.toString()}` : ''
  }`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.message || error.error || 'Failed to get purchase order');
  }

  return response.json();
}

















