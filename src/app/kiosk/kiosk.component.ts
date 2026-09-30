import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { isMobileDevice } from '../core/device';
import { I18nService } from '../core/i18n.service';
import { RemoteScanEvent, ScanResult } from '../core/models';
import { RealtimeService } from '../core/realtime.service';
import { ScanStoreService } from '../core/scan-store.service';
import { ScannerService } from '../core/scanner.service';
import { SettingsService } from '../core/settings.service';
import { CelebrationService } from '../shared/celebration.service';
import { HatComponent } from '../shared/hat.component';
import { AttractComponent } from './attract.component';
import { CameraScannerComponent } from './camera-scanner.component';

export type KioskState =
  'ready' | 'processing' | 'win' | 'lose' | 'duplicate' | 'soldout' | 'error';

@Component({
  selector: 'app-kiosk',
  imports: [HatComponent, AttractComponent, CameraScannerComponent, RouterLink],
  templateUrl: './kiosk.component.html',
  styleUrl: './kiosk.component.scss',
})
export class KioskComponent implements OnInit, OnDestroy {
  protected readonly i18n = inject(I18nService);
  protected readonly store = inject(ScanStoreService);
  private readonly scanner = inject(ScannerService);
  private readonly settingsService = inject(SettingsService);
  private readonly celebration = inject(CelebrationService);
  private readonly realtime = inject(RealtimeService);
  private readonly isMobile = isMobileDevice();

  protected readonly settings = this.settingsService.settings;
  protected readonly state = signal<KioskState>('ready');
  protected readonly result = signal<ScanResult | null>(null);
  protected readonly idle = signal(false);
  /** Set when the shown result was scanned at another station. */
  protected readonly remoteStation = signal<string | null>(null);
  /** Phones and tablets scan with the camera, desktops with a USB hand scanner. */
  protected readonly cameraMode = computed(() => {
    const mode = this.settings().inputMode;
    return mode === 'camera' || (mode === 'auto' && this.isMobile);
  });
  protected readonly hatsLeft = computed(() => {
    const total = this.settings().hatsTotal;
    return total > 0 ? Math.max(0, total - this.store.stats().winners) : null;
  });

  protected readonly resultText = computed(() => {
    const n = this.result()?.record?.number ?? '';
    const won = this.state() === 'win';
    switch (this.settings().winnerRule) {
      case 'code':
        return this.i18n.t(won ? 'winSubtitleCode' : 'loseSubtitleCode');
      case 'random':
        return this.i18n.t(won ? 'winSubtitleRandom' : 'loseSubtitleRandom', { n });
      default:
        return this.i18n.t(won ? 'winSubtitle' : 'loseSubtitle', { n });
    }
  });

  private readonly subs = new Subscription();
  private resultTimer?: number;
  private idleTimer?: number;
  private statsInterval?: number;

  ngOnInit(): void {
    this.subs.add(this.scanner.scans$.subscribe((code) => this.onScan(code)));
    this.subs.add(this.realtime.remoteScans$.subscribe((event) => this.onRemoteScan(event)));
    this.store.refreshStats().catch(() => undefined);
    // Keep the counters current when several stations share one backend.
    this.statsInterval = window.setInterval(
      () => this.store.refreshStats().catch(() => undefined),
      30_000,
    );
    this.armIdleTimer();
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
    clearTimeout(this.resultTimer);
    clearTimeout(this.idleTimer);
    clearInterval(this.statsInterval);
    this.celebration.stop();
  }

  /** Any touch or click wakes the screen up from the attract loop. */
  protected wake(): void {
    if (this.idle()) {
      this.idle.set(false);
      this.armIdleTimer();
    }
  }

  protected async onScan(code: string): Promise<void> {
    if (this.state() === 'processing') return;
    clearTimeout(this.resultTimer);
    clearTimeout(this.idleTimer);
    this.celebration.stop();
    this.idle.set(false);
    this.remoteStation.set(null);
    this.state.set('processing');

    try {
      const result = await this.store.register(code);
      this.result.set(result);
      if (result.status === 'duplicate') {
        this.state.set('duplicate');
      } else if (result.record.winner) {
        this.state.set('win');
        this.celebration.celebrate();
      } else {
        this.state.set(result.soldOut ? 'soldout' : 'lose');
      }
    } catch (err) {
      console.error('Scan could not be stored', err);
      this.result.set(null);
      this.state.set('error');
    }

    this.scheduleReset();
  }

  /** Shows the result of a scan made at another station (big screens only). */
  protected onRemoteScan(event: RemoteScanEvent): void {
    if (this.cameraMode() || !this.settings().showRemoteResults) return;
    if (this.state() === 'processing' || event.status !== 'new') return;
    clearTimeout(this.resultTimer);
    clearTimeout(this.idleTimer);
    this.celebration.stop();
    this.idle.set(false);
    this.remoteStation.set(event.record.station || '?');
    this.result.set({
      status: event.status,
      soldOut: event.soldOut,
      record: { ...event.record, code: '' },
    });
    if (event.record.winner) {
      this.state.set('win');
      this.celebration.celebrate();
    } else {
      this.state.set(event.soldOut ? 'soldout' : 'lose');
    }
    this.scheduleReset();
  }

  /** On phones a tap on the result goes straight back to the camera. */
  protected tapResult(): void {
    if (this.cameraMode() && this.state() !== 'ready' && this.state() !== 'processing')
      this.reset();
  }

  private scheduleReset(): void {
    const seconds =
      this.state() === 'win' ? this.settings().resultSeconds + 4 : this.settings().resultSeconds;
    this.resultTimer = window.setTimeout(() => this.reset(), seconds * 1000);
  }

  protected reset(): void {
    this.celebration.stop();
    this.state.set('ready');
    this.result.set(null);
    this.remoteStation.set(null);
    this.armIdleTimer();
  }

  private armIdleTimer(): void {
    clearTimeout(this.idleTimer);
    const seconds = this.settings().idleSeconds;
    // No attract loop on phones: they are held by the booth staff.
    if (seconds > 0 && !this.cameraMode()) {
      this.idleTimer = window.setTimeout(() => {
        if (this.state() === 'ready') this.idle.set(true);
      }, seconds * 1000);
    }
  }
}
