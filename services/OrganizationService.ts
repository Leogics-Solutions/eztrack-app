/**
 * Organization Service
 * Simple functions to call organization-related endpoints
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_URL || 'http://localhost:8000';
const API_VERSION = 'v1';
const BASE_URL = `${API_BASE_URL}/api/${API_VERSION}`;

// Types
export interface Organization {
  id: number;
  name: string;
  industry?: string;
  quota_pages: number;
  created_at: string;
  updated_at: string;
}

export interface ListOrganizationsResponse {
  success: boolean;
  data: Organization[];
  message: string;
}

export interface CreateOrganizationRequest {
  name: string;
  industry?: string;
  quota_pages: number;
}

export interface CreateOrganizationResponse {
  success: boolean;
  data: Organization;
  message: string;
}

export interface UpdateOrganizationRequest {
  name?: string;
  industry?: string;
  quota_pages?: number;
}

export interface UpdateOrganizationResponse {
  success: boolean;
  data: Partial<Organization>;
  message: string;
}

export type OrganizationRole = 'admin' | 'operator' | 'uploader';

export interface OrganizationMember {
  id: number;
  user_id: number;
  organization_id: number;
  role: OrganizationRole;
  email: string;
  full_name: string;
  created_at: string;
}

export interface ListOrganizationMembersResponse {
  success: boolean;
  data: OrganizationMember[];
  message: string;
}

export interface AddOrganizationMemberRequest {
  email: string;
  role: OrganizationRole;
}

export interface AddOrganizationMemberResponse {
  success: boolean;
  data: OrganizationMember;
  message: string;
}

export interface RemoveOrganizationMemberResponse {
  success: boolean;
  data: null;
  message: string;
}

export interface UpdateMemberRoleRequest {
  role: OrganizationRole;
}

export interface UpdateMemberRoleResponse {
  success: boolean;
  data: OrganizationMember;
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
 * List all organizations the current user belongs to
 * GET /organizations
 */
export async function listOrganizations(): Promise<ListOrganizationsResponse> {
  const token = getAccessToken();

  if (!token) {
    throw new Error('No access token found');
  }

  const response = await fetch(`${BASE_URL}/organizations`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.message || error.error || 'Failed to list organizations');
  }

  return response.json();
}

/**
 * Create a new organization. The creator is automatically assigned as admin.
 * POST /organizations
 */
export async function createOrganization(
  data: CreateOrganizationRequest
): Promise<CreateOrganizationResponse> {
  const token = getAccessToken();

  if (!token) {
    throw new Error('No access token found');
  }

  const response = await fetch(`${BASE_URL}/organizations`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.message || error.error || 'Failed to create organization');
  }

  return response.json();
}

/**
 * Update organization details. Admin only.
 * PUT /organizations/{org_id}
 */
export async function updateOrganization(
  orgId: number,
  data: UpdateOrganizationRequest
): Promise<UpdateOrganizationResponse> {
  const token = getAccessToken();

  if (!token) {
    throw new Error('No access token found');
  }

  const response = await fetch(`${BASE_URL}/organizations/${orgId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.message || error.error || 'Failed to update organization');
  }

  return response.json();
}

/**
 * List all members of an organization
 * GET /organizations/{org_id}/members
 */
export async function listOrganizationMembers(
  orgId: number
): Promise<ListOrganizationMembersResponse> {
  const token = getAccessToken();

  if (!token) {
    throw new Error('No access token found');
  }

  const response = await fetch(`${BASE_URL}/organizations/${orgId}/members`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.message || error.error || 'Failed to list organization members');
  }

  return response.json();
}

/**
 * Add a member to organization. Admin only.
 * POST /organizations/{org_id}/members
 */
export async function addOrganizationMember(
  orgId: number,
  data: AddOrganizationMemberRequest
): Promise<AddOrganizationMemberResponse> {
  const token = getAccessToken();

  if (!token) {
    throw new Error('No access token found');
  }

  const response = await fetch(`${BASE_URL}/organizations/${orgId}/members`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.message || error.error || 'Failed to add organization member');
  }

  return response.json();
}

/**
 * Remove a member from organization. Admin only. Cannot remove the last admin.
 * DELETE /organizations/{org_id}/members/{member_user_id}
 */
export async function removeOrganizationMember(
  orgId: number,
  memberUserId: number
): Promise<RemoveOrganizationMemberResponse> {
  const token = getAccessToken();

  if (!token) {
    throw new Error('No access token found');
  }

  const response = await fetch(`${BASE_URL}/organizations/${orgId}/members/${memberUserId}`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.message || error.error || 'Failed to remove organization member');
  }

  return response.json();
}

/**
 * Update a member's role in the organization. Admin only. Cannot demote the last admin.
 * PUT /organizations/{org_id}/members/{member_user_id}
 */
export async function updateMemberRole(
  orgId: number,
  memberUserId: number,
  data: UpdateMemberRoleRequest
): Promise<UpdateMemberRoleResponse> {
  const token = getAccessToken();

  if (!token) {
    throw new Error('No access token found');
  }

  const response = await fetch(`${BASE_URL}/organizations/${orgId}/members/${memberUserId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.message || error.error || 'Failed to update member role');
  }

  return response.json();
}

