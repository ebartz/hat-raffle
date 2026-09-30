import { Injectable, signal } from '@angular/core';

export type WinnerRule = 'counter' | 'code' | 'random';
export type Language = 'de' | 'en';
export type InputMode = 'auto' | 'scanner' | 'camera';

/** Settings that belong to one device (scan station). */
export interface DeviceSettings {
  /** `local` stores scans in the browser, otherwise the base URL of the backend. */
  backend: string;
  apiKey: string;
  /** Name of this scanning station, sent along with every scan. */
  station: string;
  /** Maximum pause between two key strokes of the barcode scanner. */
  scannerKeyTimeoutMs: number;
  /** `auto`: camera on phones/tablets, USB hand scanner everywhere else. */
  inputMode: InputMode;
}

/** Settings of the raffle itself. With a backend they are shared by all stations. */
export interface SharedSettings {
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
  language: Language;
  /** Custom texts for the attract loop. Empty values fall back to the built-in texts. */
  idleHeadlines: string[];
  idleSubline: string;
  idleCta: string;
  /** Show results of the other stations on this screen as well. */
  showRemoteResults: boolean;
}

export type Settings = DeviceSettings & SharedSettings;

export const DEFAULT_DEVICE_SETTINGS: DeviceSettings = {
  backend: 'local',
  apiKey: '',
  station: 'booth-1',
  scannerKeyTimeoutMs: 80,
  inputMode: 'auto',
};

export const DEFAULT_SHARED_SETTINGS: SharedSettings = {
  winnerRule: 'counter',
  hatsPer100: 10,
  hatsTotal: 0,
  idleSeconds: 30,
  resultSeconds: 8,
  language: 'de',
  idleHeadlines: [],
  idleSubline: '',
  idleCta: '',
  showRemoteResults: true,
};

export const DEFAULT_SETTINGS: Settings = {
  ...DEFAULT_DEVICE_SETTINGS,
  ...DEFAULT_SHARED_SETTINGS,
};

export const SHARED_KEYS = Object.keys(DEFAULT_SHARED_SETTINGS) as (keyof SharedSettings)[];

export function pickShared(settings: Partial<Settings>): Partial<SharedSettings> {
  const shared: Record<string, unknown> = {};
  for (const key of SHARED_KEYS) if (key in settings) shared[key] = settings[key];
  return shared as Partial<SharedSettings>;
}

const STORAGE_KEY = 'hat_raffle_settings';

@Injectable({ providedIn: 'root' })
export class SettingsService {
  private readonly state = signal<Settings>(this.load());
  readonly settings = this.state.asReadonly();

  get value(): Settings {
    return this.state();
  }

  get useLocal(): boolean {
    return isLocalBackend(this.state().backend);
  }

  /** True until the settings were saved on this device for the first time. */
  get isFirstStart(): boolean {
    return localStorage.getItem(STORAGE_KEY) === null;
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

  /** Applies settings received from the backend (and caches them for offline starts). */
  applyShared(shared: Partial<SharedSettings>): void {
    this.save({ ...this.state(), ...pickShared(shared) });
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

export function isLocalBackend(backend: string): boolean {
  const b = backend.trim();
  return !b || b === 'local' || !/^https?:\/\//.test(b);
}
