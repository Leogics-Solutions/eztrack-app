export const AGENT_MAX_ATTACHMENTS = 10;
export const AGENT_MAX_FILE_BYTES = 5 * 1024 * 1024;

export const AGENT_ACCEPTED_EXTENSIONS = ['.pdf', '.png', '.jpg', '.jpeg', '.webp'] as const;

export const AGENT_ACCEPT_MIME =
  'application/pdf,image/png,image/jpeg,image/webp,.pdf,.png,.jpg,.jpeg,.webp';

export function isAcceptedAgentFile(file: File): boolean {
  const lower = file.name.toLowerCase();
  return AGENT_ACCEPTED_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

export function formatAgentFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function mergePendingAgentFiles(current: File[], incoming: FileList | File[]): {
  files: File[];
  skippedTooLarge: string[];
  skippedUnsupported: string[];
  skippedLimit: number;
} {
  const skippedTooLarge: string[] = [];
  const skippedUnsupported: string[] = [];
  let skippedLimit = 0;
  const merged = [...current];

  for (const file of Array.from(incoming)) {
    if (!isAcceptedAgentFile(file)) {
      skippedUnsupported.push(file.name);
      continue;
    }
    if (file.size > AGENT_MAX_FILE_BYTES) {
      skippedTooLarge.push(file.name);
      continue;
    }
    if (merged.length >= AGENT_MAX_ATTACHMENTS) {
      skippedLimit += 1;
      continue;
    }
    const duplicate = merged.some((f) => f.name === file.name && f.size === file.size);
    if (!duplicate) {
      merged.push(file);
    }
  }

  return { files: merged, skippedTooLarge, skippedUnsupported, skippedLimit };
}

export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== 'string') {
        reject(new Error('Failed to read file'));
        return;
      }
      const comma = result.indexOf(',');
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}
