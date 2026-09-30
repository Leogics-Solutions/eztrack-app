export function returnedFilesEditable(status: string, deliveryStatus?: string, batchActive = false) {
  return !batchActive && ['WAITING_EXTERNAL_DOCUMENTS', 'EXTERNAL_DOCUMENTS_RECEIVED', 'VERIFICATION_PASSED', 'VERIFICATION_FAILED'].includes(status)
    && !['sent', 'sending', 'unknown'].includes(deliveryStatus || '');
}

export function returnedFilesError(files: { name: string; size: number }[], existingCount: number): string | null {
  if (files.length < 1 || files.length > 10) return 'Choose 1–10 files per upload.';
  if (files.length + existingCount > 20) return 'Keep at most 20 returned files in this Review.';
  for (const file of files) {
    if (!/\.(pdf|png|jpe?g|webp)$/i.test(file.name)) return `${file.name}: use PDF, PNG, JPG or WEBP.`;
    if (file.size === 0 || file.size > 25 * 1024 * 1024) return `${file.name}: choose a non-empty file up to 25 MB.`;
  }
  return null;
}
