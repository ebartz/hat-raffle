import { Injectable, inject, signal } from '@angular/core';
import { BackendService } from './backend.service';
import { SharedConfig } from './realtime.service';
import { Settings, SettingsService, pickShared } from './settings.service';

const LOCAL_PIN_KEY = 'hat_raffle_pin';

/**
 * Optional PIN/password for the config page. With a backend the PIN is stored (hashed) on the
 * server and protects the shared config for all stations; in local mode it is kept in the browser.
 */
@Injectable({ providedIn: 'root' })
export class ConfigLockService {
  private readonly backend = inject(BackendService);
  private readonly settings = inject(SettingsService);

  /** The PIN entered for the current visit of the config page. */
  readonly pin = signal<string | null>(null);

  /** Throws when the backend cannot be reached. */
  async isPinSet(): Promise<boolean> {
    if (this.settings.useLocal) return !!localStorage.getItem(LOCAL_PIN_KEY);
    const config = await this.backend.get<SharedConfig>('/api/config');
    return config.pinSet;
  }

  /** Returns false for a wrong PIN; throws on network errors or when locked out. */
  async unlock(pin: string): Promise<boolean> {
    if (this.settings.useLocal) {
      const ok = localStorage.getItem(LOCAL_PIN_KEY) === pin;
      if (ok) this.pin.set(pin);
      return ok;
    }
    try {
      await this.backend.post('/api/config/unlock', { pin });
      this.pin.set(pin);
      return true;
    } catch (err) {
      if ((err as { status?: number }).status === 403) return false;
      throw err;
    }
  }

  lock(): void {
    this.pin.set(null);
  }

  /**
   * Saves the settings. Device settings stay on this device, the raffle settings go to the
   * backend (and from there to every station). `newPin`: string = set, null = remove.
   */
  async save(settings: Settings, newPin?: string | null): Promise<void> {
    if (this.settings.useLocal) {
      this.settings.save(settings);
      if (newPin === null) localStorage.removeItem(LOCAL_PIN_KEY);
      else if (newPin) localStorage.setItem(LOCAL_PIN_KEY, newPin);
    } else {
      const body: Record<string, unknown> = { config: pickShared(settings) };
      if (newPin !== undefined) body['newPin'] = newPin;
      const config = await this.backend.put<SharedConfig>('/api/config', body, this.pin());
      this.settings.save({ ...settings, ...pickShared(config) });
    }
    if (newPin !== undefined) this.pin.set(newPin);
  }
}
