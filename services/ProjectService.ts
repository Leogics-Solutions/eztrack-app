/**
 * Project Service
 * Project management and project profitability reporting endpoints.
 */

import { BASE_URL } from './config';
import { getScopedHeaders } from './apiHelpers';

export interface Project {
  id: number;
  name: string;
  code?: string | null;
  description?: string | null;
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface ListProjectsParams {
  page?: number;
  page_size?: number;
  search?: string;
  active_only?: boolean;
}

export interface ListProjectsData {
  projects: Project[];
  total?: number;
  page?: number;
  page_size?: number;
  total_pages?: number;
}

export interface ListProjectsResponse {
  success: boolean;
  data: ListProjectsData | Project[];
  message?: string;
}

export interface CreateProjectRequest {
  name: string;
  code?: string;
  description?: string;
}

export type UpdateProjectRequest = Partial<CreateProjectRequest> & {
  is_active?: boolean;
};

export interface ProjectResponse {
  success: boolean;
  data: Project;
  message?: string;
}

export interface DeleteProjectResponse {
  success: boolean;
  data?: Project | null;
  message?: string;
}

export interface ProjectReportParams {
  date_from?: string;
  date_to?: string;
  project_id?: number;
}

export interface ProjectReportRow {
  project_id: number | null;
  project_name: string;
  project_code?: string | null;
  sales_total: number;
  cost_total: number;
  net_total: number;
  ar_invoice_count: number;
  ap_invoice_count: number;
  invoice_count: number;
}

export interface ProjectReportResponse {
  success: boolean;
  data: {
    filters: {
      date_from: string | null;
      date_to: string | null;
      project_id: number | null;
    };
    projects: ProjectReportRow[];
    totals: {
      sales_total: number;
      cost_total: number;
      net_total: number;
    };
  };
  message?: string;
}

export interface ProjectReportExcelResponse {
  blob: Blob;
  contentType: string | null;
  filename: string | null;
}

function projectDisplayName(project: Pick<Project, 'name' | 'code'>): string {
  return project.code ? `${project.code} - ${project.name}` : project.name;
}

export function normalizeProjects(payload: ListProjectsResponse): Project[] {
  const data = payload.data;
  if (Array.isArray(data)) return data;
  return data.projects || [];
}

export async function listProjects(params?: ListProjectsParams): Promise<ListProjectsResponse> {
  const queryParams = new URLSearchParams();

  if (params?.page !== undefined) queryParams.append('page', String(params.page));
  if (params?.page_size !== undefined) queryParams.append('page_size', String(params.page_size));
  if (params?.search) queryParams.append('search', params.search);
  if (params?.active_only !== undefined) queryParams.append('active_only', String(params.active_only));

  const url = `${BASE_URL}/projects/${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
  const response = await fetch(url, {
    method: 'GET',
    headers: getScopedHeaders(),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.message || error.error || 'Failed to list projects');
  }

  return response.json();
}

export async function getProject(projectId: number): Promise<ProjectResponse> {
  const response = await fetch(`${BASE_URL}/projects/${projectId}`, {
    method: 'GET',
    headers: getScopedHeaders(),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.message || error.error || 'Failed to load project');
  }

  return response.json();
}

export async function createProject(data: CreateProjectRequest): Promise<ProjectResponse> {
  const response = await fetch(`${BASE_URL}/projects/`, {
    method: 'POST',
    headers: getScopedHeaders(),
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.message || error.error || 'Failed to create project');
  }

  return response.json();
}

export async function updateProject(
  projectId: number,
  data: UpdateProjectRequest
): Promise<ProjectResponse> {
  const response = await fetch(`${BASE_URL}/projects/${projectId}`, {
    method: 'PUT',
    headers: getScopedHeaders(),
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.message || error.error || 'Failed to update project');
  }

  return response.json();
}

export async function deleteProject(projectId: number): Promise<DeleteProjectResponse> {
  const response = await fetch(`${BASE_URL}/projects/${projectId}`, {
    method: 'DELETE',
    headers: getScopedHeaders(),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.message || error.error || 'Failed to delete project');
  }

  return response.json();
}

export async function getProjectReport(
  params?: ProjectReportParams
): Promise<ProjectReportResponse> {
  const queryParams = new URLSearchParams();

  if (params?.date_from) queryParams.append('date_from', params.date_from);
  if (params?.date_to) queryParams.append('date_to', params.date_to);
  if (params?.project_id !== undefined) queryParams.append('project_id', String(params.project_id));

  const url = `${BASE_URL}/projects/report${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
  const response = await fetch(url, {
    method: 'GET',
    headers: getScopedHeaders(),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.message || error.error || 'Failed to load project report');
  }

  return response.json();
}

export async function exportProjectReportExcel(
  params?: ProjectReportParams
): Promise<ProjectReportExcelResponse> {
  const queryParams = new URLSearchParams();

  if (params?.date_from) queryParams.append('date_from', params.date_from);
  if (params?.date_to) queryParams.append('date_to', params.date_to);
  if (params?.project_id !== undefined) queryParams.append('project_id', String(params.project_id));

  const url = `${BASE_URL}/projects/report/export/excel${
    queryParams.toString() ? `?${queryParams.toString()}` : ''
  }`;
  const response = await fetch(url, {
    method: 'GET',
    headers: getScopedHeaders(),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.message || error.error || 'Failed to export project report');
  }

  const blob = await response.blob();
  const contentType = response.headers.get('Content-Type');
  const disposition = response.headers.get('Content-Disposition');
  let filename: string | null = null;

  if (disposition) {
    const match = disposition.match(/filename="?([^"]+)"?/i);
    if (match && match[1]) {
      filename = match[1];
    }
  }

  return { blob, contentType, filename };
}

export { projectDisplayName };
