export interface FileDto {
  id: number;
  originalFilename: string;
  contentType: string;
  size: number;
  checksum: string;        // internal only
  storageFilename: string; // internal only
  uploadTime: string;      // OffsetDateTime from backend
  downloadCount: number;   // not displayed
}

export type SortOption = 'name' | 'newest' | 'oldest' | 'size-desc' | 'size-asc';

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes)) return '0 B';
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const value = bytes / Math.pow(1024, i);
  return `${value.toFixed(value >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
}

export function formatDateTime(isoOffset: string): string {
  const date = new Date(isoOffset);
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(date);
}

export function iconForContentType(contentType: string): string {
  if (!contentType) return 'insert_drive_file';
  if (contentType.startsWith('image/')) return 'image';
  if (contentType === 'application/pdf') return 'picture_as_pdf';
  if (contentType.startsWith('video/')) return 'video_file';
  if (contentType.startsWith('audio/')) return 'audio_file';
  if (contentType === 'application/zip' || contentType === 'application/gzip') return 'folder_zip';
  if (contentType.startsWith('text/') || contentType === 'application/msword') return 'description';
  return 'insert_drive_file';
}
