/**
 * Dashboard Service
 * Functions to fetch aggregated dashboard data
 */

import { BASE_URL } from './config';

// Types
export interface DashboardFilters {
  date_from: string | null;
  date_to: string | null;
  vendor_id: number | null;
  status: string[];
}

export interface DashboardKpis {
  total_value: number;
  invoices_total: number;
  outstanding: number;
  invoices_pending: number;
  avg_value: number;
}

export interface DashboardCategoryBreakdownItem {
  category: string;
  total: number;
}

export interface DashboardVendorTotalItem {
  vendor_id: number;
  vendor_name: string;
  total: number;
}

export interface DashboardMonthlyTotalItem {
  month: string; // e.g. "2025-01"
  total: number;
}

export interface DashboardStatusDistributionItem {
  status: string; // draft | validated | posted | paid
  count: number;
}

export interface DashboardCharts {
  category_breakdown: DashboardCategoryBreakdownItem[];
  vendor_totals: DashboardVendorTotalItem[];
  monthly_totals: DashboardMonthlyTotalItem[];
  status_distribution: DashboardStatusDistributionItem[];
}

export interface DashboardActivityItem {
  created_at: string;
  entity: string;
  entity_id: string;
  action: string;
  details: string;
}

export interface DashboardVendorFilterOption {
  id: number;
  name: string;
}

export interface DashboardSummaryData {
  filters: DashboardFilters;
  kpis: DashboardKpis;
  charts: DashboardCharts;
  recent_activity: DashboardActivityItem[];
  vendor_filter_options: DashboardVendorFilterOption[];
}

export interface DashboardSummaryResponse {
  success: boolean;
  data: DashboardSummaryData;
  message: string;
  timestamp?: string;
}

export interface DashboardSummaryParams {
  date_from?: string;
  date_to?: string;
  vendor_id?: number;
  status?: string[];
}

/**
 * Get access token from localStorage
 */
function getAccessToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('access_token');
}

/**
 * Fetch dashboard summary data
 * GET /dashboard/summary
 */
export async function getDashboardSummary(
  params?: DashboardSummaryParams
): Promise<DashboardSummaryResponse> {
  const token = getAccessToken();

  if (!token) {
    throw new Error('No access token found');
  }

  const queryParams = new URLSearchParams();

  if (params?.date_from) {
    queryParams.append('date_from', params.date_from);
  }
  if (params?.date_to) {
    queryParams.append('date_to', params.date_to);
  }
  if (params?.vendor_id != null) {
    queryParams.append('vendor_id', String(params.vendor_id));
  }
  if (params?.status && params.status.length > 0) {
    queryParams.append('status', params.status.join(','));
  }

  const url = `${BASE_URL}/dashboard/summary${
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
    throw new Error(error.message || error.error || 'Failed to fetch dashboard summary');
  }

  return response.json();
}





































