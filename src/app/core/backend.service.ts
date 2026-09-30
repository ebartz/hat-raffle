import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, firstValueFrom, timeout } from 'rxjs';
import { SettingsService } from './settings.service';

const REQUEST_TIMEOUT_MS = 8000;

/** Unique id of this browser tab, used to recognise our own scans in the live events. */
export const CLIENT_ID = Math.random().toString(36).slice(2) + Date.now().toString(36);

/** Thin HTTP client for the configured backend. */
@Injectable({ providedIn: 'root' })
export class BackendService {
  private readonly http = inject(HttpClient);
  private readonly settings = inject(SettingsService);

  get<T>(path: string, pin?: string | null): Promise<T> {
    return this.run(this.http.get<T>(this.url(path), { headers: this.headers(pin) }));
  }

  post<T>(path: string, body: unknown, pin?: string | null): Promise<T> {
    return this.run(this.http.post<T>(this.url(path), body, { headers: this.headers(pin) }));
  }

  put<T>(path: string, body: unknown, pin?: string | null): Promise<T> {
    return this.run(this.http.put<T>(this.url(path), body, { headers: this.headers(pin) }));
  }

  url(path: string): string {
    return this.settings.value.backend + path;
  }

  private run<T>(request: Observable<T>): Promise<T> {
    return firstValueFrom(request.pipe(timeout(REQUEST_TIMEOUT_MS)));
  }

  private headers(pin?: string | null): HttpHeaders {
    let headers = new HttpHeaders();
    const key = this.settings.value.apiKey;
    if (key) headers = headers.set('X-Api-Key', key);
    if (pin) headers = headers.set('X-Config-Pin', pin);
    return headers;
  }
}
