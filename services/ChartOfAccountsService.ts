/**
 * Chart of Accounts Service
 * Simple functions to call COA-related endpoints
 */

import { BASE_URL } from './config';

// Types
export interface ChartOfAccount {
  id: number;
  account_type: string;
  account_name: string;
  description?: string;
  examples?: string;
  is_active: boolean;
  created_at: string;
}

export interface ListChartOfAccountsParams {
  active_only?: boolean;
}

export interface ListChartOfAccountsResponse {
  success: boolean;
  data: ChartOfAccount[];
  message: string;
}

export interface COAViewerAccount {
  id: number;
  account_type: string;
  account_name: string;
  description?: string;
  examples?: string;
  is_active: boolean;
  created_at: string;
  transaction_count: number;
  total_amount: number;
}

export interface COAViewerSummary {
  total_accounts: number;
  total_amount: number;
}

export interface ListChartOfAccountsViewerParams {
  account_type?: string;
  search?: string;
  active_only?: boolean;
  start_date?: string;
  end_date?: string;
}

export interface ListChartOfAccountsViewerResponse {
  success: boolean;
  data: {
    accounts: COAViewerAccount[];
    summary: COAViewerSummary;
  };
  message: string;
}

export interface GroupedChartOfAccounts {
  [account_type: string]: {
    id: number;
    account_name: string;
    description?: string;
    examples?: string;
    is_active: boolean;
    created_at: string;
  }[];
}

export interface ListChartOfAccountsGroupedParams {
  active_only?: boolean;
}

export interface ListChartOfAccountsGroupedResponse {
  success: boolean;
  data: GroupedChartOfAccounts;
  message: string;
}

export interface CreateChartOfAccountRequest {
  account_type: string;
  account_name: string;
  description?: string;
  examples?: string;
  is_active?: boolean;
}

export interface CreateChartOfAccountResponse {
  success: boolean;
  data: ChartOfAccount;
  message: string;
}

export interface GetChartOfAccountResponse {
  success: boolean;
  data: ChartOfAccount;
  message: string;
}

export interface UpdateChartOfAccountRequest {
  account_type?: string;
  account_name?: string;
  description?: string;
  examples?: string;
  is_active?: boolean;
}

export interface UpdateChartOfAccountResponse {
  success: boolean;
  data: Partial<ChartOfAccount>;
  message: string;
}

export interface DeleteChartOfAccountResponse {
  success: boolean;
  data: null;
  message: string;
}

export interface ImportDefaultCoaResponse {
  success: boolean;
  data: {
    imported: number;
    skipped: number;
    total: number;
  };
  message: string;
}

export interface UpdateDefaultCoaKeywordsResponse {
  success: boolean;
  data: {
    updated: number;
    not_found: number;
    total: number;
  };
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
 * List all chart of accounts for the current user
 * GET /chart-of-accounts
 */
export async function listChartOfAccounts(
  params?: ListChartOfAccountsParams
): Promise<ListChartOfAccountsResponse> {
  const token = getAccessToken();

  if (!token) {
    throw new Error('No access token found');
  }

  const queryParams = new URLSearchParams();
  if (params?.active_only !== undefined) {
    queryParams.append('active_only', params.active_only.toString());
  }

  const url = `${BASE_URL}/chart-of-accounts${
    queryParams.toString() ? `?${queryParams.toString()}` : ''
  }`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ error: response.statusText }));
    throw new Error(
      (error as any).message ||
        (error as any).error ||
        'Failed to list chart of accounts'
    );
  }

  return response.json();
}

/**
 * Chart of Accounts Viewer (aggregated totals)
 * GET /chart-of-accounts/viewer
 */
export async function listChartOfAccountsViewer(
  params?: ListChartOfAccountsViewerParams
): Promise<ListChartOfAccountsViewerResponse> {
  const token = getAccessToken();

  if (!token) {
    throw new Error('No access token found');
  }

  const queryParams = new URLSearchParams();
  if (params?.account_type) {
    queryParams.append('account_type', params.account_type);
  }
  if (params?.search) {
    queryParams.append('search', params.search);
  }
  if (params?.active_only !== undefined) {
    queryParams.append('active_only', params.active_only.toString());
  }
  if (params?.start_date) {
    queryParams.append('start_date', params.start_date);
  }
  if (params?.end_date) {
    queryParams.append('end_date', params.end_date);
  }

  const url = `${BASE_URL}/chart-of-accounts/viewer${
    queryParams.toString() ? `?${queryParams.toString()}` : ''
  }`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ error: response.statusText }));
    throw new Error(
      (error as any).message ||
        (error as any).error ||
        'Failed to load chart of accounts viewer'
    );
  }

  return response.json();
}

/**
 * List chart of accounts grouped by account_type
 * GET /chart-of-accounts/grouped
 */
export async function listChartOfAccountsGrouped(
  params?: ListChartOfAccountsGroupedParams
): Promise<ListChartOfAccountsGroupedResponse> {
  const token = getAccessToken();

  if (!token) {
    throw new Error('No access token found');
  }

  const queryParams = new URLSearchParams();
  if (params?.active_only !== undefined) {
    queryParams.append('active_only', params.active_only.toString());
  }

  const url = `${BASE_URL}/chart-of-accounts/grouped${
    queryParams.toString() ? `?${queryParams.toString()}` : ''
  }`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ error: response.statusText }));
    throw new Error(
      (error as any).message ||
        (error as any).error ||
        'Failed to list grouped chart of accounts'
    );
  }

  return response.json();
}

/**
 * Create a new chart of account entry
 * POST /chart-of-accounts
 */
export async function createChartOfAccount(
  data: CreateChartOfAccountRequest
): Promise<CreateChartOfAccountResponse> {
  const token = getAccessToken();

  if (!token) {
    throw new Error('No access token found');
  }

  const response = await fetch(`${BASE_URL}/chart-of-accounts`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ error: response.statusText }));
    throw new Error(
      (error as any).message ||
        (error as any).error ||
        'Failed to create chart of account'
    );
  }

  return response.json();
}

/**
 * Get a single chart of account entry
 * GET /chart-of-accounts/{account_id}
 */
export async function getChartOfAccount(
  accountId: number
): Promise<GetChartOfAccountResponse> {
  const token = getAccessToken();

  if (!token) {
    throw new Error('No access token found');
  }

  const response = await fetch(
    `${BASE_URL}/chart-of-accounts/${accountId}`,
    {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    }
  );

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ error: response.statusText }));
    throw new Error(
      (error as any).message ||
        (error as any).error ||
        'Failed to get chart of account'
    );
  }

  return response.json();
}

/**
 * Update a chart of account entry
 * PUT /chart-of-accounts/{account_id}
 */
export async function updateChartOfAccount(
  accountId: number,
  data: UpdateChartOfAccountRequest
): Promise<UpdateChartOfAccountResponse> {
  const token = getAccessToken();

  if (!token) {
    throw new Error('No access token found');
  }

  const response = await fetch(
    `${BASE_URL}/chart-of-accounts/${accountId}`,
    {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(data),
    }
  );

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ error: response.statusText }));
    throw new Error(
      (error as any).message ||
        (error as any).error ||
        'Failed to update chart of account'
    );
  }

  return response.json();
}

/**
 * Delete a chart of account entry
 * DELETE /chart-of-accounts/{account_id}
 */
export async function deleteChartOfAccount(
  accountId: number
): Promise<DeleteChartOfAccountResponse> {
  const token = getAccessToken();

  if (!token) {
    throw new Error('No access token found');
  }

  const response = await fetch(
    `${BASE_URL}/chart-of-accounts/${accountId}`,
    {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    }
  );

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ error: response.statusText }));
    throw new Error(
      (error as any).message ||
        (error as any).error ||
        'Failed to delete chart of account'
    );
  }

  return response.json();
}

/**
 * Import default chart of accounts
 * POST /chart-of-accounts/import-defaults
 */
export async function importDefaultChartOfAccounts(): Promise<ImportDefaultCoaResponse> {
  const token = getAccessToken();

  if (!token) {
    throw new Error('No access token found');
  }

  const response = await fetch(
    `${BASE_URL}/chart-of-accounts/import-defaults`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    }
  );

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ error: response.statusText }));
    throw new Error(
      (error as any).message ||
        (error as any).error ||
        'Failed to import default chart of accounts'
    );
  }

  return response.json();
}

/**
 * Update default COA keywords
 * POST /chart-of-accounts/update-default-keywords
 */
export async function updateDefaultCoaKeywords(): Promise<UpdateDefaultCoaKeywordsResponse> {
  const token = getAccessToken();

  if (!token) {
    throw new Error('No access token found');
  }

  const response = await fetch(
    `${BASE_URL}/chart-of-accounts/update-default-keywords`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    }
  );

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ error: response.statusText }));
    throw new Error(
      (error as any).message ||
        (error as any).error ||
        'Failed to update default COA keywords'
    );
  }

  return response.json();
}


