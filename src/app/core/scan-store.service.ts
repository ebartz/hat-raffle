import { Injectable, inject, signal } from '@angular/core';
import { BackendService, CLIENT_ID } from './backend.service';
import { RegisterOptions, ScanRecord, ScanResult, ScanStats } from './models';
import { SettingsService } from './settings.service';
import { isWinningScan, normalizeCode } from './winner';

const LOCAL_KEY = 'hat_raffle_scans';

/**
 * Persists scanned badges either in the browser (local mode) or in the
 * configured backend. The backend is the single source of truth when set.
 */
@Injectable({ providedIn: 'root' })
export class ScanStoreService {
  private readonly backend = inject(BackendService);
  private readonly settings = inject(SettingsService);

  readonly stats = signal<ScanStats>({ total: 0, winners: 0 });

  async register(rawCode: string): Promise<ScanResult> {
    const code = normalizeCode(rawCode);
    const s = this.settings.value;
    // With a backend the server decides about the winner using the shared config.
    const result = this.settings.useLocal
      ? this.registerLocal(code, {
          rule: s.winnerRule,
          hatsTotal: s.hatsTotal,
          hatsPer100: s.hatsPer100,
          station: s.station,
        })
      : await this.backend.post<ScanResult>('/api/scans', {
          code,
          station: s.station,
          clientId: CLIENT_ID,
        });
    this.refreshStats().catch(() => undefined);
    return result;
  }

  /** Lists all scans. The backend requires the config PIN once one is set. */
  async list(pin?: string | null): Promise<ScanRecord[]> {
    if (this.settings.useLocal) return this.loadLocal();
    return (await this.backend.get<{ scans: ScanRecord[] }>('/api/scans', pin)).scans;
  }

  async refreshStats(): Promise<ScanStats> {
    let stats: ScanStats;
    if (this.settings.useLocal) {
      const scans = this.loadLocal();
      stats = { total: scans.length, winners: scans.filter((s) => s.winner).length };
    } else {
      stats = await this.backend.get<ScanStats>('/api/stats');
    }
    this.stats.set(stats);
    return stats;
  }

  async healthz(): Promise<boolean> {
    if (this.settings.useLocal) return true;
    try {
      await this.backend.get('/healthz');
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
}
