import { HttpEvent, HttpHandlerFn, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { Observable, tap } from 'rxjs';

export const httpLoggingInterceptor: HttpInterceptorFn = (
  req: HttpRequest<unknown>,
  next: HttpHandlerFn
): Observable<HttpEvent<unknown>> => {
  const started = Date.now();
  // Pass through
  return next(req).pipe(
    tap({
      next: () => {
        if (typeof window !== 'undefined' && (window as any).DEBUG_HTTP) {
          // eslint-disable-next-line no-console
          console.debug(`[HTTP] ${req.method} ${req.url} in ${Date.now() - started}ms`);
        }
      },
      error: (err) => {
        if (typeof window !== 'undefined') {
          // eslint-disable-next-line no-console
          console.error(`[HTTP] ${req.method} ${req.url} failed in ${Date.now() - started}ms`, err);
        }
      }
    })
  );
};
