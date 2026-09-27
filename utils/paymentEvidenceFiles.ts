type EvidenceFile = { name: string; size: number; lastModified: number; type: string };

export function paymentFilesForMessage<T extends { file_key: string; capture_event_id?: number }>(files: T[], captureEventId?: number): T[] {
  if (captureEventId == null) return [];
  const seen = new Set<string>();
  return files.filter((file) => {
    if (file.capture_event_id !== captureEventId || !file.file_key || seen.has(file.file_key)) return false;
    seen.add(file.file_key);
    return true;
  });
}

export function appendPaymentEvidence<T extends EvidenceFile>(existing: T[], incoming: T[]) {
  const files = [...existing];
  const messages: string[] = [];
  const key = (file: T) => `${file.name}\0${file.size}\0${file.lastModified}`;
  const seen = new Set(files.map(key));
  for (const file of incoming) {
    if (!/\.(pdf|png|jpe?g|webp|gif|bmp|tiff?)$/i.test(file.name)) {
      messages.push('Supported files: PDF, PNG, JPG, WEBP, GIF, BMP and TIFF.');
    } else if (seen.has(key(file))) {
      messages.push('Already selected files were skipped.');
    } else if (files.length >= 20) {
      messages.push('You can select up to 20 files. Remove a file to add another.');
    } else {
      seen.add(key(file));
      files.push(file);
    }
  }
  return { files, message: [...new Set(messages)].join(' ') || null };
}
