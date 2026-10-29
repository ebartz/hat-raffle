import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { BackendService } from './backend.service';
import { SettingsService } from './settings.service';

/**
 * `open`: this device may use the backend. `password`: the backend is protected and this device
 * has no (valid) password yet. `offline`: the backend cannot be reached right now.
 */
export type AccessState = 'local' | 'checking' | 'open' | 'password' | 'offline';
export type UnlockResult = 'ok' | 'wrong' | 'locked' | 'offline';

const RETRY_MS = 10_000;

/**
 * Access of this device to a backend that is protected by a password (the config PIN). The
 * password is asked for once and then stored on the device; every request sends it along.
 */
@Injectable({ providedIn: 'root' })
export class AccessService {
  private readonly backend = inject(BackendService);
  private readonly settings = inject(SettingsService);
  private retryTimer?: number;

  readonly state = signal<AccessState>('checking');
  private readonly target = computed(() => {
    const { backend, apiKey } = this.settings.settings();
    return `${backend}|${apiKey}`;
  });

  constructor() {
    // Check again whenever this device is pointed to another backend.
    effect(() => {
      this.target();
      untracked(() => this.check());
    });
    this.backend.forbidden$.subscribe(() => this.forget());
  }

  async check(): Promise<void> {
    clearTimeout(this.retryTimer);
    if (this.settings.useLocal) return this.state.set('local');
    this.state.set('checking');
    try {
      const { pinSet } = await this.backend.get<{ pinSet: boolean }>('/api/access');
      if (!pinSet) return this.state.set('open');
      const pin = this.settings.value.backendPin;
      if (!pin) return this.state.set('password');
      this.state.set((await this.unlock(pin)) === 'ok' ? 'open' : 'password');
    } catch {
      this.state.set('offline');
    }
    if (this.state() === 'offline') {
      this.retryTimer = window.setTimeout(() => this.check(), RETRY_MS);
    }
  }

  /** Checks the password with the backend and stores it on this device when it is right. */
  async unlock(pin: string): Promise<UnlockResult> {
    try {
      await this.backend.post('/api/config/unlock', { pin }, pin);
    } catch (err) {
      const status = (err as { status?: number }).status;
      if (status === 403) {
        this.forget();
        return 'wrong';
      }
      return status === 429 ? 'locked' : 'offline';
    }
    this.remember(pin);
    return 'ok';
  }

  /** Stores a password that is known to be right (e.g. after changing the PIN). */
  remember(pin: string): void {
    if (pin !== this.settings.value.backendPin) {
      this.settings.save({ ...this.settings.value, backendPin: pin });
    }
    this.state.set(this.settings.useLocal ? 'local' : 'open');
  }

  private forget(): void {
    if (this.settings.value.backendPin) {
      this.settings.save({ ...this.settings.value, backendPin: '' });
    }
    if (!this.settings.useLocal) this.state.set('password');
  }
}
