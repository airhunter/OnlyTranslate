export type DroppedFileSelection =
  | { file: File; error?: never }
  | { file?: never; error: 'EMPTY' | 'MULTIPLE' };

export function selectDroppedFile(files: FileList | readonly File[]): DroppedFileSelection {
  const dropped = Array.from(files);
  if (dropped.length === 0) return { error: 'EMPTY' };
  if (dropped.length > 1) return { error: 'MULTIPLE' };
  return { file: dropped[0] };
}
