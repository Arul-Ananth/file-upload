import { HttpClient, HttpErrorResponse, HttpEvent, HttpEventType, HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, throwError } from 'rxjs';
import { FileDto } from './file.interface';

export interface UploadProgressEvent {
  type: 'progress';
  percentage: number; // 0-100
}

export interface UploadCompletedEvent {
  type: 'completed';
  file: FileDto;
}

export type UploadEvent = UploadProgressEvent | UploadCompletedEvent;

@Injectable({ providedIn: 'root' })
export class FileService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/files';

  list(): Observable<FileDto[]> {
    return this.http.get<FileDto[]>(this.baseUrl).pipe(catchError(this.handleError('Unable to load files. Please refresh the page.')));
  }

  upload(file: File): Observable<UploadEvent> {
    const formData = new FormData();
    formData.append('file', file);

    return this.http
      .post<FileDto>(this.baseUrl, formData, {
        reportProgress: true,
        observe: 'events'
      })
      .pipe(
        map((event: HttpEvent<FileDto>): UploadEvent => {
          switch (event.type) {
            case HttpEventType.Sent:
              return { type: 'progress', percentage: 0 };
            case HttpEventType.UploadProgress: {
              const total = event.total ?? file.size;
              const percentage = Math.round(((event.loaded ?? 0) / (total || 1)) * 100);
              return { type: 'progress', percentage };
            }
            case HttpEventType.Response:
              return { type: 'completed', file: event.body as FileDto };
            default:
              return { type: 'progress', percentage: 0 };
          }
        }),
        catchError(this.handleError('Unable to upload file. Please check your connection and try again.'))
      );
  }

  download(id: number): Observable<{ blob: Blob; filename: string }>
  {
    return this.http
      .get(`${this.baseUrl}/${id}/download`, {
        observe: 'response',
        responseType: 'blob'
      })
      .pipe(
        map((res) => {
          const contentDisposition = res.headers.get('content-disposition') || '';
          const filename = this.extractFilename(contentDisposition) || 'download';
          return { blob: res.body as Blob, filename };
        }),
        catchError(this.handleError('Failed to download file. Please try again later.'))
      );
  }

  delete(id: number): Observable<void> {
    return this.http
      .delete<void>(`${this.baseUrl}/${id}`)
      .pipe(catchError(this.handleError('Could not delete the file. It may have been already removed.')));
  }

  private extractFilename(cd: string): string | null {
    // content-disposition: attachment; filename="myfile.txt"; filename*=UTF-8''myfile.txt
    const filenameStar = /filename\*=UTF-8''([^;\n]+)/i.exec(cd);
    if (filenameStar?.[1]) return decodeURIComponent(filenameStar[1]);
    const filenameQuoted = /filename\s*=\s*"([^"]+)"/i.exec(cd);
    if (filenameQuoted?.[1]) return filenameQuoted[1];
    const filenameBare = /filename\s*=\s*([^;\n]+)/i.exec(cd);
    if (filenameBare?.[1]) return filenameBare[1];
    return null;
  }

  private handleError(userMessage: string) {
    return (error: unknown) => {
      let message = userMessage;
      if (error instanceof HttpErrorResponse) {
        if (error.status === 0) {
          message = 'Network connection issue. Please check your internet connection.';
        }
      }
      return throwError(() => new Error(message));
    };
  }
}
