import { Injectable, NgZone, OnDestroy, computed, effect, inject, signal } from '@angular/core';
import { Subject } from 'rxjs';
import { AccessService } from './access.service';
import { CLIENT_ID } from './backend.service';
import { RemoteScanEvent, ScanStats } from './models';
import { ScanStoreService } from './scan-store.service';
import { SettingsService, SharedSettings } from './settings.service';

export type SharedConfig = SharedSettings & { pinSet: boolean };

/**
 * Live connection to the backend (Server-Sent Events). Keeps the shared config and the
 * counters of all stations in sync and reports scans made at other stations.
 */
@Injectable({ providedIn: 'root' })
export class RealtimeService implements OnDestroy {
  private readonly settings = inject(SettingsService);
  private readonly store = inject(ScanStoreService);
  private readonly zone = inject(NgZone);
  private readonly access = inject(AccessService);

  private source?: EventSource;
  private readonly remoteScansSubject = new Subject<RemoteScanEvent>();
  /** Scans made at other stations. */
  readonly remoteScans$ = this.remoteScansSubject.asObservable();
  readonly connected = signal(false);
  readonly pinSet = signal(false);

  /** Only connects once this device may use the backend (password entered if needed). */
  private readonly url = computed(() => {
    const { backend, apiKey, backendPin } = this.settings.settings();
    if (this.access.state() !== 'open') return null;
    const params = new URLSearchParams();
    if (apiKey) params.set('key', apiKey);
    if (backendPin) params.set('pin', backendPin);
    const query = params.toString();
    return `${backend}/api/events${query ? `?${query}` : ''}`;
  });

  constructor() {
    // (Re)connect whenever the backend, the API key or the password changes.
    effect(() => this.connect(this.url()));
  }

  ngOnDestroy(): void {
    this.disconnect();
  }

  private connect(url: string | null): void {
    if (this.source && this.source.url === url) return;
    this.disconnect();
    if (!url) return;

    const source = new EventSource(url);
    this.source = source;
    const on = <T>(event: string, handler: (data: T) => void) =>
      source.addEventListener(event, (e) =>
        this.zone.run(() => handler(JSON.parse((e as MessageEvent).data))),
      );

    on<{ config: SharedConfig; stats: ScanStats }>('hello', ({ config, stats }) => {
      this.connected.set(true);
      this.applyConfig(config);
      this.store.stats.set(stats);
    });
    on<SharedConfig>('config', (config) => this.applyConfig(config));
    on<RemoteScanEvent>('scan', (event) => {
      this.store.stats.set(event.stats);
      if (event.clientId !== CLIENT_ID) this.remoteScansSubject.next(event);
    });
    source.onerror = () =>
      this.zone.run(() => {
        this.connected.set(false);
        // EventSource does not tell why: ask the backend whether the password was changed.
        if (source.readyState === EventSource.CLOSED) this.access.check();
      });
  }

  private applyConfig({ pinSet, ...shared }: SharedConfig): void {
    this.pinSet.set(pinSet);
    this.settings.applyShared(shared);
  }

  private disconnect(): void {
    this.source?.close();
    this.source = undefined;
    this.connected.set(false);
  }
}
