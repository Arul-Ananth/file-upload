import { ChangeDetectionStrategy, Component, computed, inject, signal, Inject, Injectable } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpEventType, HttpHeaders } from '@angular/common/http';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatListModule } from '@angular/material/list';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ScrollingModule } from '@angular/cdk/scrolling';
import { Observable, firstValueFrom, map } from 'rxjs';

// --- Interfaces & Types ---

export interface FileDto {
  id: number;
  originalFilename: string; // Matching user's component usage
  size: number;
  contentType: string;
  uploadTime: string; // ISO string
  url?: string;
}

export type SortOption = 'name' | 'newest' | 'oldest' | 'size-desc' | 'size-asc';

export type UploadEvent =
  | { type: 'progress'; percentage: number }
  | { type: 'completed'; file: FileDto };


// --- Utils ---

export function formatBytes(bytes: number, decimals = 2): string {
  if (!+bytes) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

export function formatDateTime(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function iconForContentType(type: string): string {
  if (type.startsWith('image/')) return 'image';
  if (type.startsWith('audio/')) return 'audio_file';
  if (type.startsWith('video/')) return 'video_file';
  if (type.includes('pdf')) return 'picture_as_pdf';
  if (type.includes('text') || type.includes('json') || type.includes('xml')) return 'description';
  if (type.includes('zip') || type.includes('compressed') || type.includes('tar')) return 'folder_zip';
  return 'insert_drive_file';
}

// --- Service ---

@Injectable({ providedIn: 'root' })
export class FileService {
  private http = inject(HttpClient);
  // Base URL matches the Spring Boot Controller @RequestMapping("/files")
  private readonly baseUrl = 'http://localhost:8080/files';

  upload(file: File): Observable<UploadEvent> {
    const formData = new FormData();
    // Key 'file' matches @RequestPart("file") in Spring Boot
    formData.append('file', file);

    return this.http.post<FileDto>(this.baseUrl, formData, {
      reportProgress: true,
      observe: 'events'
    }).pipe(
      map(event => {
        if (event.type === HttpEventType.UploadProgress && event.total) {
          return { type: 'progress', percentage: Math.round(100 * event.loaded / event.total) };
        } else if (event.type === HttpEventType.Response) {
          return { type: 'completed', file: event.body! };
        }
        return { type: 'progress', percentage: 0 };
      })
    );
  }

  list(): Observable<FileDto[]> {
    return this.http.get<FileDto[]>(this.baseUrl);
  }

  download(id: number): Observable<{ blob: Blob, filename: string }> {
    return this.http.get(`${this.baseUrl}/${id}/download`, {
      responseType: 'blob',
      observe: 'response'
    }).pipe(
      map(res => {
        // Try to extract filename from Content-Disposition header
        const contentDisposition = res.headers.get('Content-Disposition');
        let filename = 'download';
        if (contentDisposition) {
          const match = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
          if (match && match[1]) {
            filename = match[1].replace(/['"]/g, '');
          }
        }
        return { blob: res.body!, filename };
      })
    );
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }
}

// --- Confirm Dialog Component ---

@Component({
  selector: 'simple-confirm-dialog',
  standalone: true,
  imports: [MatDialogModule, MatButtonModule, MatIconModule],
  template: `
    <h2 mat-dialog-title class="dialog-title">
      <mat-icon color="warn" aria-hidden="true">warning</mat-icon>
      Confirm Delete
    </h2>
    <div mat-dialog-content>
      {{ data.message }}
    </div>
    <div mat-dialog-actions align="end">
      <button mat-button mat-dialog-close="false">Cancel</button>
      <button mat-flat-button color="warn" [mat-dialog-close]="true">Delete</button>
    </div>
  `,
  styles: [`
    .dialog-title { display: flex; align-items: center; gap: 8px; }
  `]
})
export class SimpleConfirmDialog {
  constructor(@Inject(MAT_DIALOG_DATA) public data: { message: string }) {}
}

// --- Main App Component ---

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    // Material & CDK
    MatToolbarModule,
    MatIconModule,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatListModule,
    MatProgressBarModule,
    MatSnackBarModule,
    MatDialogModule,
    MatTooltipModule,
    ScrollingModule
  ],
  template: `
<mat-toolbar color="primary" class="app-toolbar" role="banner">
  <mat-icon class="logo-icon">cloud_queue</mat-icon>
  <span class="app-title">Spring FileShare</span>
</mat-toolbar>

<div class="container" role="main">
  <!-- Upload Section -->
  <mat-card class="upload-card" aria-label="Upload Section">
    <mat-card-header>
      <mat-card-title>Upload Files</mat-card-title>
    </mat-card-header>
    <mat-card-content>
      <div class="drop-zone" [class.drag-over]="dragOver()"
           (drop)="onDrop($event)"
           (dragover)="onDragOver($event)"
           (dragleave)="onDragLeave($event)"
           (click)="fileInput.click()"
           tabindex="0" role="button" aria-label="Drag and drop files here or click to select">
        <mat-icon class="upload-icon" aria-hidden="true">upload_file</mat-icon>
        <div class="upload-text">
          <div class="primary-text">Drag & drop a file here</div>
          <div class="secondary-text">or click to browse</div>
        </div>
        <input type="file" #fileInput hidden (change)="onFileSelected(fileInput)"/>
      </div>

      @if (selectedFile()) {
        <div class="selected-file" aria-live="polite">
          <div class="file-info">
            <mat-icon color="primary">attach_file</mat-icon>
            <div class="file-details">
              <span class="name">{{ selectedFile()!.name }}</span>
              <span class="size">{{ formatBytes(selectedFile()!.size) }}</span>
            </div>
          </div>
          <button mat-icon-button (click)="selectedFile.set(null)" matTooltip="Remove file">
            <mat-icon>close</mat-icon>
          </button>
        </div>
      }

      @if (isUploading()) {
        <div class="progress-section">
          <div class="progress-label">
            <span>Uploading...</span>
            <span>{{ uploadProgress() }}%</span>
          </div>
          <mat-progress-bar mode="determinate" [value]="uploadProgress()"></mat-progress-bar>
        </div>
      }
    </mat-card-content>
    <mat-card-actions align="end">
        <button mat-button (click)="selectedFile.set(null)" [disabled]="!selectedFile() || isUploading()">Clear</button>
        <button mat-flat-button color="primary" (click)="uploadSelected()" [disabled]="!selectedFile() || isUploading()">
          {{ isUploading() ? 'Uploading...' : 'Upload' }}
        </button>
    </mat-card-actions>
  </mat-card>

  <!-- Controls Section -->
  <div class="controls-row">
    <mat-form-field appearance="outline" class="search-field" subscriptSizing="dynamic">
      <mat-label>Search files</mat-label>
      <mat-icon matPrefix>search</mat-icon>
      <input matInput placeholder="Type to filter..." [value]="searchQuery()" (input)="searchQuery.set($event.target['value'])" />
      @if (searchQuery()) {
        <button mat-icon-button matSuffix (click)="searchQuery.set('')">
          <mat-icon>close</mat-icon>
        </button>
      }
    </mat-form-field>

    <mat-form-field appearance="outline" class="sort-field" subscriptSizing="dynamic">
      <mat-label>Sort by</mat-label>
      <mat-select [value]="sortBy()" (valueChange)="sortBy.set($event)">
        <mat-option value="newest">Newest first</mat-option>
        <mat-option value="oldest">Oldest first</mat-option>
        <mat-option value="name">Name (A-Z)</mat-option>
        <mat-option value="size-desc">Size (Largest)</mat-option>
        <mat-option value="size-asc">Size (Smallest)</mat-option>
      </mat-select>
    </mat-form-field>
  </div>

  <!-- File List Section -->
  <mat-card class="list-card" aria-label="Files">
    <mat-card-content class="list-content">
      @if (isLoading()) {
        <div class="loading-state">
           <mat-progress-bar mode="indeterminate"></mat-progress-bar>
           <p>Loading files...</p>
        </div>
      } @else {
        @if (files().length === 0) {
          <div class="empty-state">
            <mat-icon>cloud_off</mat-icon>
            <h3>No files found</h3>
            <p>Upload a file to get started</p>
          </div>
        } @else if (filteredFiles().length === 0) {
          <div class="empty-state">
            <mat-icon>search_off</mat-icon>
            <h3>No matches found</h3>
            <p>Try adjusting your search</p>
          </div>
        } @else {
          <cdk-virtual-scroll-viewport itemSize="72" class="viewport">
            <div class="file-item" *cdkVirtualFor="let f of filteredFiles(); trackBy: trackById">
              <div class="file-item-content">
                <div class="icon-wrapper">
                  <mat-icon>{{ iconForContentType(f.contentType) }}</mat-icon>
                </div>
                <div class="file-meta">
                  <div class="file-name" [matTooltip]="f.originalFilename">{{ f.originalFilename }}</div>
                  <div class="file-sub">
                    <span>{{ formatBytes(f.size) }}</span>
                    <span class="separator">•</span>
                    <span>{{ formatDateTime(f.uploadTime) }}</span>
                  </div>
                </div>
                <div class="file-actions">
                  <button mat-icon-button color="primary" (click)="download(f)" matTooltip="Download">
                    <mat-icon>download</mat-icon>
                  </button>
                  <button mat-icon-button color="warn" (click)="delete(f)" matTooltip="Delete">
                    <mat-icon>delete</mat-icon>
                  </button>
                </div>
              </div>
            </div>
          </cdk-virtual-scroll-viewport>
        }
      }
    </mat-card-content>
  </mat-card>
</div>
  `,
  styles: [`
    :host {
      display: flex;
      flex-direction: column;
      height: 100vh;
      background-color: #f5f5f5;
    }

    .app-toolbar {
      position: sticky;
      top: 0;
      z-index: 100;
      gap: 12px;
    }

    .container {
      max-width: 800px;
      margin: 0 auto;
      padding: 24px;
      width: 100%;
      box-sizing: border-box;
      display: flex;
      flex-direction: column;
      gap: 24px;
      flex: 1;
      overflow: hidden;
    }

    /* Upload Card */
    .drop-zone {
      border: 2px dashed #ccc;
      border-radius: 8px;
      padding: 32px;
      text-align: center;
      cursor: pointer;
      transition: all 0.2s ease;
      background: #fafafa;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
    }

    .drop-zone:hover, .drop-zone.drag-over {
      border-color: #3f51b5;
      background: #e8eaf6;
    }

    .upload-icon {
      transform: scale(2);
      color: #757575;
      margin-bottom: 8px;
    }

    .primary-text { font-size: 1.1rem; font-weight: 500; color: #333; }
    .secondary-text { color: #666; font-size: 0.9rem; }

    .selected-file {
      margin-top: 16px;
      background: white;
      border: 1px solid #e0e0e0;
      border-radius: 4px;
      padding: 8px 16px;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .file-info { display: flex; align-items: center; gap: 12px; }
    .file-details { display: flex; flex-direction: column; }
    .file-details .name { font-weight: 500; font-size: 0.9rem; }
    .file-details .size { font-size: 0.8rem; color: #666; }

    .progress-section { margin-top: 16px; }
    .progress-label { display: flex; justify-content: space-between; margin-bottom: 4px; font-size: 0.85rem; color: #666; }

    /* Controls */
    .controls-row {
      display: flex;
      gap: 16px;
    }
    .search-field { flex: 2; }
    .sort-field { flex: 1; }

    /* File List */
    .list-card {
      flex: 1;
      display: flex;
      flex-direction: column;
      min-height: 0; /* Important for scrolling */
    }

    .list-content {
      height: 100%;
      padding: 0 !important; /* Reset padding for virtual scroll */
      display: flex;
      flex-direction: column;
    }

    .viewport {
      flex: 1;
      height: 400px; /* Fallback height */
    }

    .file-item {
      height: 72px;
      padding: 0 16px;
      border-bottom: 1px solid #eee;
    }

    .file-item-content {
      height: 100%;
      display: flex;
      align-items: center;
      gap: 16px;
    }

    .icon-wrapper {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      background: #e3f2fd;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #1976d2;
    }

    .file-meta {
      flex: 1;
      min-width: 0; /* Text truncation */
    }

    .file-name {
      font-weight: 500;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .file-sub {
      font-size: 0.85rem;
      color: #666;
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .separator { font-weight: bold; }

    .file-actions {
      display: flex;
      gap: 4px;
      opacity: 0.6;
      transition: opacity 0.2s;
    }

    .file-item:hover .file-actions { opacity: 1; }

    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 48px;
      color: #999;
    }
    .empty-state mat-icon { transform: scale(3); margin-bottom: 24px; color: #e0e0e0; }
    .empty-state h3 { margin: 0; color: #666; font-weight: 500; }

    .loading-state { padding: 24px; text-align: center; color: #666; }

    /* Mobile Responsive */
    @media (max-width: 600px) {
      .container { padding: 12px; gap: 12px; }
      .controls-row { flex-direction: column; gap: 0; }
      .file-sub { font-size: 0.75rem; }
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class App {
  private readonly fileService = inject(FileService);
  private readonly snack = inject(MatSnackBar);
  private readonly dialog = inject(MatDialog);

  // State signals
  readonly files = signal<FileDto[]>([]);
  readonly isLoading = signal<boolean>(false);
  readonly isUploading = signal<boolean>(false);
  readonly uploadProgress = signal<number>(0);
  readonly searchQuery = signal<string>('');
  readonly sortBy = signal<SortOption>('newest');
  readonly selectedFile = signal<File | null>(null);
  readonly dragOver = signal<boolean>(false);

  readonly filteredFiles = computed(() => {
    const q = this.searchQuery().trim().toLowerCase();
    const sort = this.sortBy();
    let out = this.files();

    if (q) {
      out = out.filter((f) => f.originalFilename.toLowerCase().includes(q));
    }

    switch (sort) {
      case 'name':
        out = [...out].sort((a, b) => a.originalFilename.localeCompare(b.originalFilename));
        break;
      case 'newest':
        out = [...out].sort((a, b) => new Date(b.uploadTime).getTime() - new Date(a.uploadTime).getTime());
        break;
      case 'oldest':
        out = [...out].sort((a, b) => new Date(a.uploadTime).getTime() - new Date(b.uploadTime).getTime());
        break;
      case 'size-desc':
        out = [...out].sort((a, b) => b.size - a.size);
        break;
      case 'size-asc':
        out = [...out].sort((a, b) => a.size - b.size);
        break;
    }
    return out;
  });

  constructor() {
    this.loadFiles();
  }

  // UI helpers
  protected formatBytes = formatBytes;
  protected formatDateTime = formatDateTime;
  protected iconForContentType = iconForContentType;
  // trackBy for virtual scroll
  protected trackById = (index: number, f: FileDto) => f.id;

  // Actions
  loadFiles(): void {
    this.isLoading.set(true);
    this.fileService.list().subscribe({
      next: (files) => this.files.set(files),
      error: (err) => this.showError(err),
      complete: () => this.isLoading.set(false)
    });
  }

  onFileSelected(input: HTMLInputElement): void {
    const file = input.files && input.files[0] ? input.files[0] : null;
    this.selectedFile.set(file);
    // Reset input so same file can be selected again if needed
    input.value = '';
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.dragOver.set(false);
    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      this.selectedFile.set(files[0]);
    }
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.dragOver.set(true);
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.dragOver.set(false);
  }

  uploadSelected(): void {
    const file = this.selectedFile();
    if (!file) {
      this.snack.open('Please select a file to upload', 'Close', { duration: 3000 });
      return;
    }
    if (this.isUploading()) return;

    this.isUploading.set(true);
    this.uploadProgress.set(0);

    this.fileService.upload(file).subscribe({
      next: (evt: UploadEvent) => {
        if (evt.type === 'progress') {
          this.uploadProgress.set(evt.percentage);
        } else if (evt.type === 'completed') {
          this.snack.open('File uploaded successfully!', 'OK', { duration: 3000 });
          // Add to list and sort/filter will update automatically
          this.files.update(current => [evt.file, ...current]);
          this.selectedFile.set(null);
          this.uploadProgress.set(0);
          this.isUploading.set(false);
        }
      },
      error: (err: unknown) => {
        this.showError(err);
        this.isUploading.set(false);
        this.uploadProgress.set(0);
      }
    });
  }

  download(file: FileDto): void {
    this.fileService.download(file.id).subscribe({
      next: ({ blob, filename }) => {
        const a = document.createElement('a');
        const url = window.URL.createObjectURL(blob);
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      },
      error: (err) => this.showError(err)
    });
  }

  async delete(file: FileDto): Promise<void> {
    const confirmed = await this.confirm(`Are you sure you want to delete "${file.originalFilename}"?`);
    if (!confirmed) return;

    this.fileService.delete(file.id).subscribe({
      next: () => {
        this.files.update(current => current.filter(f => f.id !== file.id));
        this.snack.open('File deleted', 'Undo', { duration: 3000 });
      },
      error: (err) => this.showError(err)
    });
  }

  private showError(err: unknown) {
    console.error(err);
    const message = err instanceof Error ? err.message : 'Operation failed';
    this.snack.open(message, 'Close', { duration: 4000, panelClass: 'error-snack' });
  }

  private confirm(message: string): Promise<boolean> {
    const dialogRef = this.dialog.open(SimpleConfirmDialog, {
      data: { message },
      width: '400px'
    });
    return firstValueFrom(dialogRef.afterClosed()).then((v) => !!v);
  }
}
