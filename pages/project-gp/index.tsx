'use client';

import { AppLayout } from '@/components/layout';
import { useLanguage } from '@/lib/i18n';
import { useOrganization } from '@/lib/OrganizationContext';
import { Edit2, Plus, RotateCcw, Trash2, X } from 'lucide-react';
import type { FormEvent } from 'react';
import { useCallback, useEffect, useState } from 'react';
import {
  createProject,
  deleteProject,
  exportProjectReportExcel,
  getProjectReport,
  listProjects,
  normalizeProjects,
  projectDisplayName,
  updateProject,
  type Project,
  type ProjectReportRow,
} from '@/services';

interface ProjectGpFilters {
  date_from: string;
  date_to: string;
  project_id: string;
}

interface ProjectFormState {
  id: number | null;
  name: string;
  code: string;
  description: string;
  is_active: boolean;
}

const emptyProjectForm: ProjectFormState = {
  id: null,
  name: '',
  code: '',
  description: '',
  is_active: true,
};

const moneyFormatter = new Intl.NumberFormat('en-MY', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const formatMoney = (value: number) => `MYR ${moneyFormatter.format(value || 0)}`;

const formatPercent = (value: number) =>
  `${value.toLocaleString('en-MY', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })}%`;

const getGpMargin = (sales: number, gp: number) => {
  if (!sales) return 0;
  return (gp / sales) * 100;
};

export default function ProjectGpPage() {
  const { t } = useLanguage();
  const { selectedOrganizationId } = useOrganization();
  const [projects, setProjects] = useState<Project[]>([]);
  const [rows, setRows] = useState<ProjectReportRow[]>([]);
  const [totals, setTotals] = useState({
    sales_total: 0,
    cost_total: 0,
    net_total: 0,
  });
  const [filters, setFilters] = useState<ProjectGpFilters>({
    date_from: '',
    date_to: '',
    project_id: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [projectForm, setProjectForm] = useState<ProjectFormState>(emptyProjectForm);
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [isSavingProject, setIsSavingProject] = useState(false);
  const [deletingProjectId, setDeletingProjectId] = useState<number | null>(null);
  const [reactivatingProjectId, setReactivatingProjectId] = useState<number | null>(null);
  const [projectsError, setProjectsError] = useState<string | null>(null);
  const [isLoadingProjects, setIsLoadingProjects] = useState(false);
  const [reportRefreshKey, setReportRefreshKey] = useState(0);

  const loadProjects = useCallback(async () => {
    setIsLoadingProjects(true);
    setProjectsError(null);

    try {
      const response = await listProjects({
        page: 1,
        page_size: 100,
        active_only: false,
      });
      setProjects(normalizeProjects(response));
    } catch (projectError) {
      console.error('Failed to load projects', projectError);
      setProjects([]);
      setProjectsError(projectError instanceof Error ? projectError.message : 'Failed to load projects');
    } finally {
      setIsLoadingProjects(false);
    }
  }, []);

  useEffect(() => {
    loadProjects();
  }, [loadProjects, selectedOrganizationId]);

  useEffect(() => {
    const loadReport = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await getProjectReport({
          date_from: filters.date_from || undefined,
          date_to: filters.date_to || undefined,
          project_id: filters.project_id ? Number(filters.project_id) : undefined,
        });

        setRows(response.data.projects || []);
        setTotals(response.data.totals || { sales_total: 0, cost_total: 0, net_total: 0 });
      } catch (reportError) {
        setError(reportError instanceof Error ? reportError.message : 'Failed to load project GP');
      } finally {
        setIsLoading(false);
      }
    };

    loadReport();
  }, [filters, selectedOrganizationId, reportRefreshKey]);

  const setDatePreset = (preset: 'month' | 'quarter' | 'year') => {
    const today = new Date();
    let dateFrom: Date;

    if (preset === 'year') {
      dateFrom = new Date(today.getFullYear(), 0, 1);
    } else if (preset === 'quarter') {
      const quarter = Math.floor(today.getMonth() / 3);
      dateFrom = new Date(today.getFullYear(), quarter * 3, 1);
    } else {
      dateFrom = new Date(today.getFullYear(), today.getMonth(), 1);
    }

    setFilters((current) => ({
      ...current,
      date_from: dateFrom.toISOString().split('T')[0],
      date_to: today.toISOString().split('T')[0],
    }));
  };

  const totalGpMargin = getGpMargin(totals.sales_total, totals.net_total);

  const activeProjects = projects.filter((project) => project.is_active !== false);
  const projectsById = new Map(projects.map((project) => [project.id, project]));

  const resetProjectForm = () => {
    setProjectForm(emptyProjectForm);
    setProjectsError(null);
  };

  const openCreateProjectModal = () => {
    resetProjectForm();
    setIsProjectModalOpen(true);
  };

  const editProject = (project: Project) => {
    setProjectForm({
      id: project.id,
      name: project.name || '',
      code: project.code || '',
      description: project.description || '',
      is_active: project.is_active !== false,
    });
    setProjectsError(null);
    setIsProjectModalOpen(true);
  };

  const closeProjectModal = () => {
    if (isSavingProject) return;
    setIsProjectModalOpen(false);
    resetProjectForm();
  };

  const handleSaveProject = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const name = projectForm.name.trim();
    if (!name) {
      setProjectsError('Project name is required.');
      return;
    }

    setIsSavingProject(true);
    setProjectsError(null);

    try {
      const payload = {
        name,
        code: projectForm.code.trim() || undefined,
        description: projectForm.description.trim() || undefined,
      };

      if (projectForm.id === null) {
        await createProject(payload);
      } else {
        await updateProject(projectForm.id, {
          ...payload,
          is_active: projectForm.is_active,
        });
      }

      resetProjectForm();
      setIsProjectModalOpen(false);
      await loadProjects();
      setReportRefreshKey((current) => current + 1);
    } catch (projectError) {
      setProjectsError(projectError instanceof Error ? projectError.message : 'Failed to save project');
    } finally {
      setIsSavingProject(false);
    }
  };

  const handleDeleteProject = async (project: Project) => {
    if (!window.confirm(`Deactivate project "${projectDisplayName(project)}"?`)) return;

    setDeletingProjectId(project.id);
    setProjectsError(null);

    try {
      await deleteProject(project.id);
      if (filters.project_id === String(project.id)) {
        setFilters((current) => ({ ...current, project_id: '' }));
      }
      if (projectForm.id === project.id) {
        setIsProjectModalOpen(false);
        resetProjectForm();
      }
      await loadProjects();
      setReportRefreshKey((current) => current + 1);
    } catch (projectError) {
      setProjectsError(projectError instanceof Error ? projectError.message : 'Failed to delete project');
    } finally {
      setDeletingProjectId(null);
    }
  };

  const handleReactivateProject = async (project: Project) => {
    setReactivatingProjectId(project.id);
    setProjectsError(null);

    try {
      await updateProject(project.id, {
        name: project.name,
        code: project.code || undefined,
        description: project.description || undefined,
        is_active: true,
      });
      await loadProjects();
      setReportRefreshKey((current) => current + 1);
    } catch (projectError) {
      setProjectsError(projectError instanceof Error ? projectError.message : 'Failed to reactivate project');
    } finally {
      setReactivatingProjectId(null);
    }
  };

  const handleExportExcel = async () => {
    setIsExporting(true);
    setError(null);

    try {
      const { blob, filename } = await exportProjectReportExcel({
        date_from: filters.date_from || undefined,
        date_to: filters.date_to || undefined,
        project_id: filters.project_id ? Number(filters.project_id) : undefined,
      });

      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename || 'project-gp-report.xlsx';
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (exportError) {
      setError(exportError instanceof Error ? exportError.message : 'Failed to export project report');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <AppLayout pageName={t.nav.projects}>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold">{t.nav.projects}</h1>
            <p className="mt-1 text-sm text-[var(--muted-foreground)]">
              Gross profit by project. Sales come from AR invoices, costs come from AP invoices.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={openCreateProjectModal}
              className="inline-flex w-fit items-center gap-2 rounded-md border border-[var(--border)] px-4 py-2 text-sm font-medium transition-colors hover:bg-[var(--hover-bg)]"
            >
              <Plus className="h-4 w-4" />
              New Project
            </button>
            <button
              type="button"
              onClick={handleExportExcel}
              disabled={isExporting}
              className="w-fit rounded-md bg-[var(--primary)] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--primary-hover)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isExporting ? 'Exporting...' : 'Export Excel'}
            </button>
          </div>
        </div>

        {error && (
          <div className="rounded-lg border border-red-500 bg-red-500/10 p-4 text-sm text-red-600">
            {error}
          </div>
        )}

        {projectsError && (
          <div className="rounded-lg border border-red-500 bg-red-500/10 p-4 text-sm text-red-600">
            {projectsError}
          </div>
        )}

        <section className="rounded-lg border border-[var(--border)] bg-white p-6 dark:bg-[var(--card)]">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <div>
              <label className="mb-2 block text-sm font-medium">Date From</label>
              <input
                type="date"
                value={filters.date_from}
                onChange={(event) =>
                  setFilters((current) => ({ ...current, date_from: event.target.value }))
                }
                className="w-full rounded-md border border-[var(--border)] bg-white px-3 py-2 dark:bg-[var(--input)]"
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium">Date To</label>
              <input
                type="date"
                value={filters.date_to}
                onChange={(event) =>
                  setFilters((current) => ({ ...current, date_to: event.target.value }))
                }
                className="w-full rounded-md border border-[var(--border)] bg-white px-3 py-2 dark:bg-[var(--input)]"
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium">Project</label>
              <select
                value={filters.project_id}
                onChange={(event) =>
                  setFilters((current) => ({ ...current, project_id: event.target.value }))
                }
                className="w-full rounded-md border border-[var(--border)] bg-white px-3 py-2 dark:bg-[var(--input)]"
              >
                <option value="">All Projects</option>
                {activeProjects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {projectDisplayName(project)}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-end gap-2">
              <button
                type="button"
                onClick={() => setDatePreset('month')}
                className="rounded-md border border-[var(--border)] px-3 py-2 text-sm hover:bg-[var(--hover-bg)]"
              >
                Month
              </button>
              <button
                type="button"
                onClick={() => setDatePreset('quarter')}
                className="rounded-md border border-[var(--border)] px-3 py-2 text-sm hover:bg-[var(--hover-bg)]"
              >
                Quarter
              </button>
              <button
                type="button"
                onClick={() => setDatePreset('year')}
                className="rounded-md border border-[var(--border)] px-3 py-2 text-sm hover:bg-[var(--hover-bg)]"
              >
                Year
              </button>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <div className="rounded-lg border border-[var(--border)] bg-white p-5 dark:bg-[var(--card)]">
            <div className="text-sm text-[var(--muted-foreground)]">Sales</div>
            <div className="mt-2 text-2xl font-bold text-green-600">
              {formatMoney(totals.sales_total)}
            </div>
          </div>
          <div className="rounded-lg border border-[var(--border)] bg-white p-5 dark:bg-[var(--card)]">
            <div className="text-sm text-[var(--muted-foreground)]">Cost</div>
            <div className="mt-2 text-2xl font-bold text-red-600">
              {formatMoney(totals.cost_total)}
            </div>
          </div>
          <div className="rounded-lg border border-[var(--border)] bg-white p-5 dark:bg-[var(--card)]">
            <div className="text-sm text-[var(--muted-foreground)]">Gross Profit</div>
            <div className="mt-2 text-2xl font-bold">{formatMoney(totals.net_total)}</div>
          </div>
          <div className="rounded-lg border border-[var(--border)] bg-white p-5 dark:bg-[var(--card)]">
            <div className="text-sm text-[var(--muted-foreground)]">GP Margin</div>
            <div className="mt-2 text-2xl font-bold">{formatPercent(totalGpMargin)}</div>
          </div>
        </section>

        <section className="overflow-hidden rounded-lg border border-[var(--border)] bg-white dark:bg-[var(--card)]">
          <div className="flex items-center justify-between border-b border-[var(--border)] p-6">
            <h2 className="text-xl font-semibold">Project Report Breakdown</h2>
            {(isLoading || isLoadingProjects) && (
              <span className="text-sm text-[var(--muted-foreground)]">Loading...</span>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-[var(--border)] bg-[var(--muted)]">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Project</th>
                  <th className="px-4 py-3 text-right text-sm font-semibold">Sales</th>
                  <th className="px-4 py-3 text-right text-sm font-semibold">Cost</th>
                  <th className="px-4 py-3 text-right text-sm font-semibold">Gross Profit</th>
                  <th className="px-4 py-3 text-right text-sm font-semibold">GP Margin</th>
                  <th className="px-4 py-3 text-right text-sm font-semibold">AR Invoices</th>
                  <th className="px-4 py-3 text-right text-sm font-semibold">AP Invoices</th>
                  <th className="px-4 py-3 text-right text-sm font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {rows.length === 0 ? (
                  <tr>
                    <td
                      className="px-4 py-8 text-center text-sm text-[var(--muted-foreground)]"
                      colSpan={8}
                    >
                      No project invoice data found for the selected filters.
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => {
                    const gpMargin = getGpMargin(row.sales_total, row.net_total);
                    const project = row.project_id ? projectsById.get(row.project_id) : undefined;
                    const isInactive = project?.is_active === false;
                    return (
                      <tr key={row.project_id ?? row.project_name}>
                        <td className="px-4 py-3 text-sm">
                          <div className="font-medium">{row.project_name || 'Unassigned'}</div>
                          {row.project_code && (
                            <div className="text-xs text-[var(--muted-foreground)]">
                              {row.project_code}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right text-sm">
                          {formatMoney(row.sales_total)}
                        </td>
                        <td className="px-4 py-3 text-right text-sm">
                          {formatMoney(row.cost_total)}
                        </td>
                        <td className="px-4 py-3 text-right text-sm font-semibold">
                          {formatMoney(row.net_total)}
                        </td>
                        <td className="px-4 py-3 text-right text-sm">
                          {formatPercent(gpMargin)}
                        </td>
                        <td className="px-4 py-3 text-right text-sm">{row.ar_invoice_count}</td>
                        <td className="px-4 py-3 text-right text-sm">{row.ap_invoice_count}</td>
                        <td className="px-4 py-3">
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => project && editProject(project)}
                              disabled={!project}
                              className="inline-flex items-center gap-2 rounded-md border border-[var(--border)] px-3 py-2 text-sm hover:bg-[var(--hover-bg)] disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              <Edit2 className="h-4 w-4" />
                              Edit
                            </button>
                            {isInactive ? (
                              <button
                                type="button"
                                onClick={() => project && handleReactivateProject(project)}
                                disabled={!project || reactivatingProjectId === project.id}
                                className="inline-flex items-center gap-2 rounded-md border border-[var(--border)] px-3 py-2 text-sm hover:bg-[var(--hover-bg)] disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                <RotateCcw className="h-4 w-4" />
                                {project && reactivatingProjectId === project.id
                                  ? 'Reactivating...'
                                  : 'Reactivate'}
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => project && handleDeleteProject(project)}
                                disabled={!project || deletingProjectId === project.id}
                                className="inline-flex items-center gap-2 rounded-md border border-red-500 px-3 py-2 text-sm text-red-600 hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                <Trash2 className="h-4 w-4" />
                                {project && deletingProjectId === project.id ? 'Deleting...' : 'Delete'}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>

        {isProjectModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-lg rounded-lg border border-[var(--border)] bg-white shadow-xl dark:bg-[var(--card)]">
              <div className="flex items-center justify-between border-b border-[var(--border)] px-6 py-4">
                <h2 className="text-lg font-semibold">
                  {projectForm.id === null ? 'Create Project' : 'Edit Project'}
                </h2>
                <button
                  type="button"
                  onClick={closeProjectModal}
                  disabled={isSavingProject}
                  className="rounded-md p-2 hover:bg-[var(--hover-bg)] disabled:cursor-not-allowed disabled:opacity-60"
                  aria-label="Close project modal"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleSaveProject} className="space-y-4 px-6 py-5">
                <div>
                  <label className="mb-1 block text-sm font-medium">
                    Name <span className="text-[var(--error)]">*</span>
                  </label>
                  <input
                    value={projectForm.name}
                    onChange={(event) =>
                      setProjectForm((current) => ({ ...current, name: event.target.value }))
                    }
                    autoFocus
                    className="w-full rounded-md border border-[var(--border)] bg-white px-3 py-2 outline-none focus:ring-2 focus:ring-[var(--primary)] dark:bg-[var(--input)]"
                    placeholder="Project Name"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium">Code</label>
                  <input
                    value={projectForm.code}
                    onChange={(event) =>
                      setProjectForm((current) => ({ ...current, code: event.target.value }))
                    }
                    className="w-full rounded-md border border-[var(--border)] bg-white px-3 py-2 outline-none focus:ring-2 focus:ring-[var(--primary)] dark:bg-[var(--input)]"
                    placeholder="PROJ-001"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium">Description</label>
                  <textarea
                    value={projectForm.description}
                    onChange={(event) =>
                      setProjectForm((current) => ({ ...current, description: event.target.value }))
                    }
                    rows={3}
                    className="w-full rounded-md border border-[var(--border)] bg-white px-3 py-2 outline-none focus:ring-2 focus:ring-[var(--primary)] dark:bg-[var(--input)]"
                    placeholder="Optional description"
                  />
                </div>

                {projectForm.id !== null && (
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={projectForm.is_active}
                      onChange={(event) =>
                        setProjectForm((current) => ({
                          ...current,
                          is_active: event.target.checked,
                        }))
                      }
                      className="h-4 w-4"
                    />
                    Active
                  </label>
                )}

                <div className="flex justify-end gap-3 border-t border-[var(--border)] pt-4">
                  <button
                    type="button"
                    onClick={closeProjectModal}
                    disabled={isSavingProject}
                    className="rounded-md border border-[var(--border)] px-4 py-2 text-sm font-medium hover:bg-[var(--hover-bg)] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingProject}
                    className="inline-flex items-center gap-2 rounded-md bg-[var(--primary)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--primary-hover)] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Plus className="h-4 w-4" />
                    {isSavingProject
                      ? 'Saving...'
                      : projectForm.id === null
                        ? 'Create Project'
                        : 'Update Project'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
