/**
 * Vendor Service
 * Simple functions to call vendor-related endpoints
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_URL || 'http://localhost:8000';
const API_VERSION = 'v1';
const BASE_URL = `${API_BASE_URL}/api/${API_VERSION}`;

// Types
export interface Vendor {
  id: number;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  company_reg_no?: string;
  sst_number?: string;
  is_active: boolean;
}

export interface ListVendorsParams {
  skip?: number;
  limit?: number;
  active_only?: boolean;
}

export interface ListVendorsResponse {
  success: boolean;
  data: Vendor[];
  message: string;
}

export interface CreateVendorRequest {
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  company_reg_no?: string;
  sst_number?: string;
}

export interface CreateVendorResponse {
  success: boolean;
  data: Vendor;
  message: string;
}

export interface GetVendorResponse {
  success: boolean;
  data: Vendor;
  message: string;
}

export interface UpdateVendorRequest {
  name?: string;
  email?: string;
  phone?: string;
  address?: string;
  company_reg_no?: string;
  sst_number?: string;
  is_active?: boolean;
}

export interface UpdateVendorResponse {
  success: boolean;
  data: Partial<Vendor>;
  message: string;
}

export interface DeleteVendorResponse {
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
 * List all vendors for the current user
 * GET /vendors
 */
export async function listVendors(params?: ListVendorsParams): Promise<ListVendorsResponse> {
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
  if (params?.active_only !== undefined) {
    queryParams.append('active_only', params.active_only.toString());
  }

  const url = `${BASE_URL}/vendors${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.message || error.error || 'Failed to list vendors');
  }

  return response.json();
}

/**
 * Create a new vendor
 * POST /vendors
 */
export async function createVendor(data: CreateVendorRequest): Promise<CreateVendorResponse> {
  const token = getAccessToken();

  if (!token) {
    throw new Error('No access token found');
  }

  const response = await fetch(`${BASE_URL}/vendors`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.message || error.error || 'Failed to create vendor');
  }

  return response.json();
}

/**
 * Get vendor details by ID
 * GET /vendors/{vendor_id}
 */
export async function getVendor(vendorId: number): Promise<GetVendorResponse> {
  const token = getAccessToken();

  if (!token) {
    throw new Error('No access token found');
  }

  const response = await fetch(`${BASE_URL}/vendors/${vendorId}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.message || error.error || 'Failed to get vendor');
  }

  return response.json();
}

/**
 * Update vendor information
 * PUT /vendors/{vendor_id}
 */
export async function updateVendor(
  vendorId: number,
  data: UpdateVendorRequest
): Promise<UpdateVendorResponse> {
  const token = getAccessToken();

  if (!token) {
    throw new Error('No access token found');
  }

  const response = await fetch(`${BASE_URL}/vendors/${vendorId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.message || error.error || 'Failed to update vendor');
  }

  return response.json();
}

/**
 * Delete a vendor
 * DELETE /vendors/{vendor_id}
 */
export async function deleteVendor(vendorId: number): Promise<DeleteVendorResponse> {
  const token = getAccessToken();

  if (!token) {
    throw new Error('No access token found');
  }

  const response = await fetch(`${BASE_URL}/vendors/${vendorId}`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.message || error.error || 'Failed to delete vendor');
  }

  return response.json();
}

