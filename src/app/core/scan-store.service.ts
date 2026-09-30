import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom, timeout } from 'rxjs';
import { RegisterOptions, ScanRecord, ScanResult, ScanStats } from './models';
import { SettingsService } from './settings.service';
import { isWinningScan, normalizeCode } from './winner';

const LOCAL_KEY = 'hat_raffle_scans';
const REQUEST_TIMEOUT_MS = 8000;

/**
 * Persists scanned badges either in the browser (local mode) or in the
 * configured backend. The backend is the single source of truth when set.
 */
@Injectable({ providedIn: 'root' })
export class ScanStoreService {
  private readonly http = inject(HttpClient);
  private readonly settings = inject(SettingsService);

  readonly stats = signal<ScanStats>({ total: 0, winners: 0 });

  async register(rawCode: string): Promise<ScanResult> {
    const code = normalizeCode(rawCode);
    const s = this.settings.value;
    const options: RegisterOptions = {
      rule: s.winnerRule,
      hatsTotal: s.hatsTotal,
      hatsPer100: s.hatsPer100,
      station: s.station,
    };
    const result = this.settings.useLocal
      ? this.registerLocal(code, options)
      : await firstValueFrom(
          this.http
            .post<ScanResult>(
              this.url('/api/scans'),
              { code, ...options },
              { headers: this.headers() },
            )
            .pipe(timeout(REQUEST_TIMEOUT_MS)),
        );
    this.refreshStats().catch(() => undefined);
    return result;
  }

  async list(): Promise<ScanRecord[]> {
    if (this.settings.useLocal) return this.loadLocal();
    const res = await firstValueFrom(
      this.http
        .get<{ scans: ScanRecord[] }>(this.url('/api/scans'), { headers: this.headers() })
        .pipe(timeout(REQUEST_TIMEOUT_MS)),
    );
    return res.scans;
  }

  async refreshStats(): Promise<ScanStats> {
    let stats: ScanStats;
    if (this.settings.useLocal) {
      const scans = this.loadLocal();
      stats = { total: scans.length, winners: scans.filter((s) => s.winner).length };
    } else {
      stats = await firstValueFrom(
        this.http
          .get<ScanStats>(this.url('/api/stats'), { headers: this.headers() })
          .pipe(timeout(REQUEST_TIMEOUT_MS)),
      );
    }
    this.stats.set(stats);
    return stats;
  }

  async healthz(): Promise<boolean> {
    if (this.settings.useLocal) return true;
    try {
      await firstValueFrom(this.http.get(this.url('/healthz')).pipe(timeout(REQUEST_TIMEOUT_MS)));
      return true;
    } catch {
      return false;
    }
  }

  /** Only available for local storage; backend data is never deleted from the UI. */
  clearLocal(): void {
    localStorage.removeItem(LOCAL_KEY);
    this.stats.set({ total: 0, winners: 0 });
  }

  private registerLocal(code: string, options: RegisterOptions): ScanResult {
    const scans = this.loadLocal();
    const existing = scans.find((s) => s.code === code);
    if (existing) return { status: 'duplicate', record: existing, soldOut: false };

    const number = scans.length + 1;
    const winners = scans.filter((s) => s.winner).length;
    const wouldWin = isWinningScan(options.rule, number, code, {
      previous: scans,
      hatsPer100: options.hatsPer100,
    });
    const soldOut = wouldWin && options.hatsTotal > 0 && winners >= options.hatsTotal;
    const record: ScanRecord = {
      code,
      number,
      winner: wouldWin && !soldOut,
      station: options.station,
      timestamp: new Date().toISOString(),
    };
    scans.push(record);
    localStorage.setItem(LOCAL_KEY, JSON.stringify(scans));
    return { status: 'new', record, soldOut };
  }

  private loadLocal(): ScanRecord[] {
    try {
      return JSON.parse(localStorage.getItem(LOCAL_KEY) ?? '[]');
    } catch {
      return [];
    }
  }

  private url(path: string): string {
    return this.settings.value.backend + path;
  }

  private headers(): HttpHeaders {
    const key = this.settings.value.apiKey;
    return key ? new HttpHeaders({ 'X-Api-Key': key }) : new HttpHeaders();
  }
}
