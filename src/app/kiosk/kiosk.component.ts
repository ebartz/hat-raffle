import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { I18nService } from '../core/i18n.service';
import { ScanResult } from '../core/models';
import { ScanStoreService } from '../core/scan-store.service';
import { ScannerService } from '../core/scanner.service';
import { SettingsService } from '../core/settings.service';
import { CelebrationService } from '../shared/celebration.service';
import { HatComponent } from '../shared/hat.component';
import { AttractComponent } from './attract.component';

export type KioskState =
  'ready' | 'processing' | 'win' | 'lose' | 'duplicate' | 'soldout' | 'error';

@Component({
  selector: 'app-kiosk',
  imports: [HatComponent, AttractComponent, RouterLink],
  templateUrl: './kiosk.component.html',
  styleUrl: './kiosk.component.scss',
})
export class KioskComponent implements OnInit, OnDestroy {
  protected readonly i18n = inject(I18nService);
  protected readonly store = inject(ScanStoreService);
  private readonly scanner = inject(ScannerService);
  private readonly settingsService = inject(SettingsService);
  private readonly celebration = inject(CelebrationService);

  protected readonly settings = this.settingsService.settings;
  protected readonly state = signal<KioskState>('ready');
  protected readonly result = signal<ScanResult | null>(null);
  protected readonly idle = signal(false);
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

  private sub?: Subscription;
  private resultTimer?: number;
  private idleTimer?: number;
  private statsInterval?: number;

  ngOnInit(): void {
    this.sub = this.scanner.scans$.subscribe((code) => this.onScan(code));
    this.store.refreshStats().catch(() => undefined);
    // Keep the counters current when several stations share one backend.
    this.statsInterval = window.setInterval(
      () => this.store.refreshStats().catch(() => undefined),
      30_000,
    );
    this.armIdleTimer();
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
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

    const seconds =
      this.state() === 'win' ? this.settings().resultSeconds + 4 : this.settings().resultSeconds;
    this.resultTimer = window.setTimeout(() => this.reset(), seconds * 1000);
  }

  protected reset(): void {
    this.celebration.stop();
    this.state.set('ready');
    this.result.set(null);
    this.armIdleTimer();
  }

  private armIdleTimer(): void {
    clearTimeout(this.idleTimer);
    const seconds = this.settings().idleSeconds;
    if (seconds > 0) {
      this.idleTimer = window.setTimeout(() => {
        if (this.state() === 'ready') this.idle.set(true);
      }, seconds * 1000);
    }
  }
}
