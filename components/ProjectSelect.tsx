'use client';

import { useState } from 'react';
import { createPortal } from 'react-dom';
import {
  createProject,
  projectDisplayName,
  type Project,
} from '@/services';

interface ProjectSelectProps {
  value: string;
  projects: Project[];
  onChange: (value: string) => void;
  onProjectCreated?: (project: Project) => void;
  helperText?: string | null;
  selectClassName?: string;
  disabled?: boolean;
}

const defaultSelectClassName =
  'w-full px-3 py-2 border border-[var(--border)] rounded-md bg-white dark:bg-[var(--input)] focus:ring-2 focus:ring-[var(--primary)] outline-none';

export function ProjectSelect({
  value,
  projects,
  onChange,
  onProjectCreated,
  helperText,
  selectClassName = defaultSelectClassName,
  disabled = false,
}: ProjectSelectProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [description, setDescription] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const closeModal = () => {
    if (isSaving) return;
    setIsModalOpen(false);
    setName('');
    setCode('');
    setDescription('');
    setError(null);
  };

  const handleCreateProject = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Project name is required.');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const response = await createProject({
        name: trimmedName,
        code: code.trim() || undefined,
        description: description.trim() || undefined,
      });
      const createdProject = response.data;
      onProjectCreated?.(createdProject);
      onChange(String(createdProject.id));
      setIsModalOpen(false);
      setName('');
      setCode('');
      setDescription('');
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'Failed to create project');
    } finally {
      setIsSaving(false);
    }
  };

  const modalContent = (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-xl border border-[var(--border)] bg-white shadow-xl dark:bg-[var(--card)]">
        <div className="border-b border-[var(--border)] px-6 py-4">
          <h2 className="text-lg font-semibold text-[var(--foreground)]">Create Project</h2>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">
            Add a project and assign it to this invoice flow immediately.
          </p>
        </div>

        <form onSubmit={handleCreateProject} className="space-y-4 px-6 py-5">
          {error && (
            <div className="rounded-md border border-red-500 bg-red-500/10 px-3 py-2 text-sm text-red-600">
              {error}
            </div>
          )}

          <div>
            <label className="mb-1 block text-sm font-medium text-[var(--foreground)]">
              Project name <span className="text-[var(--error)]">*</span>
            </label>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              autoFocus
              placeholder="SAMURAI Project A"
              className="w-full rounded-md border border-[var(--border)] bg-white px-3 py-2 outline-none focus:ring-2 focus:ring-[var(--primary)] dark:bg-[var(--input)]"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-[var(--foreground)]">
              Project code
            </label>
            <input
              value={code}
              onChange={(event) => setCode(event.target.value)}
              placeholder="SAM-A"
              className="w-full rounded-md border border-[var(--border)] bg-white px-3 py-2 outline-none focus:ring-2 focus:ring-[var(--primary)] dark:bg-[var(--input)]"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-[var(--foreground)]">
              Description
            </label>
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={3}
              placeholder="Optional description"
              className="w-full rounded-md border border-[var(--border)] bg-white px-3 py-2 outline-none focus:ring-2 focus:ring-[var(--primary)] dark:bg-[var(--input)]"
            />
          </div>

          <div className="flex justify-end gap-3 border-t border-[var(--border)] pt-4">
            <button
              type="button"
              onClick={closeModal}
              disabled={isSaving}
              className="rounded-md border border-[var(--border)] px-4 py-2 text-sm font-medium hover:bg-[var(--hover-bg)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="rounded-md bg-[var(--primary)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--primary-hover)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSaving ? 'Creating...' : 'Create Project'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  return (
    <>
      <div className="flex gap-2">
        <select
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className={selectClassName}
          disabled={disabled}
        >
          <option value="">No project</option>
          {projects.map((project) => (
            <option key={project.id} value={project.id}>
              {projectDisplayName(project)}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => setIsModalOpen(true)}
          disabled={disabled}
          className="shrink-0 rounded-md border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--foreground)] transition-colors hover:bg-[var(--hover-bg)] disabled:cursor-not-allowed disabled:opacity-60"
        >
          + New Project
        </button>
      </div>

      {helperText && (
        <small className="text-xs text-[var(--muted-foreground)] mt-1 block">
          {helperText}
        </small>
      )}

      {isModalOpen && typeof document !== 'undefined' && createPortal(modalContent, document.body)}
    </>
  );
}
