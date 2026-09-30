import { Injectable, signal } from '@angular/core';

export type WinnerRule = 'counter' | 'code' | 'random';
export type Language = 'de' | 'en';

export interface Settings {
  /** `local` stores scans in the browser, otherwise the base URL of the backend. */
  backend: string;
  apiKey: string;
  /** Name of this scanning station, sent along with every scan. */
  station: string;
  /**
   * `counter`: the n-th participant wins if n is prime.
   * `code`: the digits of the badge are checked.
   * `random`: exactly `hatsPer100` random winners in every block of 100 scans.
   */
  winnerRule: WinnerRule;
  hatsPer100: number;
  /** Number of hats available, 0 = unlimited. */
  hatsTotal: number;
  idleSeconds: number;
  resultSeconds: number;
  /** Maximum pause between two key strokes of the barcode scanner. */
  scannerKeyTimeoutMs: number;
  language: Language;
  /** Custom texts for the attract loop. Empty values fall back to the built-in texts. */
  idleHeadlines: string[];
  idleSubline: string;
  idleCta: string;
}

export const DEFAULT_SETTINGS: Settings = {
  backend: 'local',
  apiKey: '',
  station: 'booth-1',
  winnerRule: 'counter',
  hatsPer100: 10,
  hatsTotal: 0,
  idleSeconds: 30,
  resultSeconds: 8,
  scannerKeyTimeoutMs: 80,
  language: 'de',
  idleHeadlines: [],
  idleSubline: '',
  idleCta: '',
};

const STORAGE_KEY = 'hat_raffle_settings';

@Injectable({ providedIn: 'root' })
export class SettingsService {
  private readonly state = signal<Settings>(this.load());
  readonly settings = this.state.asReadonly();

  get value(): Settings {
    return this.state();
  }

  get useLocal(): boolean {
    const backend = this.state().backend.trim();
    return !backend || backend === 'local' || !/^https?:\/\//.test(backend);
  }

  save(settings: Settings): void {
    const next = {
      ...DEFAULT_SETTINGS,
      ...settings,
      backend: settings.backend.trim().replace(/\/+$/, ''),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    this.state.set(next);
  }

  private load(): Settings {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : { ...DEFAULT_SETTINGS };
    } catch {
      return { ...DEFAULT_SETTINGS };
    }
  }
}
