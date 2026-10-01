import { DatePipe } from '@angular/common';
import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { ConfigLockService } from '../core/config-lock.service';
import { isMobileDevice } from '../core/device';
import { I18nService } from '../core/i18n.service';
import { ScanRecord } from '../core/models';
import { RealtimeService } from '../core/realtime.service';
import { ScanStoreService } from '../core/scan-store.service';
import { ScannerService } from '../core/scanner.service';
import { Settings, SettingsService } from '../core/settings.service';
import { HatComponent } from '../shared/hat.component';
import { QrCodeComponent } from '../shared/qr-code.component';

type Health = 'unknown' | 'checking' | 'healthy' | 'unhealthy' | 'local';
/** `offline`: backend unreachable – only the connection settings can be edited. */
type Access = 'checking' | 'locked' | 'open' | 'offline';

const MIN_PIN_LENGTH = 4;

@Component({
  selector: 'app-config',
  imports: [FormsModule, RouterLink, DatePipe, HatComponent, QrCodeComponent],
  templateUrl: './config.component.html',
  styleUrl: './config.component.scss',
})
export class ConfigComponent implements OnInit, OnDestroy {
  private readonly settingsService = inject(SettingsService);
  private readonly store = inject(ScanStoreService);
  private readonly scanner = inject(ScannerService);
  private readonly lock = inject(ConfigLockService);
  private readonly i18n = inject(I18nService);
  protected readonly realtime = inject(RealtimeService);
  protected readonly isMobile = isMobileDevice();

  protected form: Settings = { ...this.settingsService.value };
  protected headlinesText = this.form.idleHeadlines.join('\n');
  protected readonly access = signal<Access>('checking');
  protected readonly pinSet = signal(false);
  protected readonly selected = signal<ScanRecord | null>(null);
  protected readonly message = signal<{ text: string; ok: boolean } | null>(null);
  protected readonly health = signal<Health>('unknown');
  protected readonly lastScan = signal('');
  protected readonly scans = signal<ScanRecord[]>([]);
  protected readonly scansError = signal('');
  protected readonly unlockError = signal('');
  protected testCode = '';
  protected unlockPin = '';
  protected newPin = '';
  protected newPinRepeat = '';
  protected removePin = false;

  private sub?: Subscription;
  private messageTimer?: number;

  ngOnInit(): void {
    this.sub = this.scanner.scans$.subscribe((code) => this.lastScan.set(code));
    this.checkAccess();
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
    clearTimeout(this.messageTimer);
    // Leaving the page locks it again.
    this.lock.lock();
  }

  protected get isLocal(): boolean {
    return this.settingsService.useLocal;
  }

  protected get defaultHeadlines(): string {
    return this.i18n.texts().idleHeadlines.join('\n');
  }

  protected get defaultSubline(): string {
    return this.i18n.t('idleSubline');
  }

  protected get defaultCta(): string {
    return this.i18n.t('idleCta');
  }

  protected async checkAccess(): Promise<void> {
    this.access.set('checking');
    this.lock.lock();
    this.resetForm();
    try {
      const pinSet = await this.lock.isPinSet();
      this.pinSet.set(pinSet);
      this.access.set(pinSet ? 'locked' : 'open');
      if (!pinSet) this.loadScans();
    } catch {
      this.access.set('offline');
    }
  }

  protected async unlock(): Promise<void> {
    this.unlockError.set('');
    try {
      if (await this.lock.unlock(this.unlockPin)) {
        this.unlockPin = '';
        this.access.set('open');
        this.loadScans();
      } else {
        this.unlockError.set('Wrong PIN or password.');
      }
    } catch (err) {
      this.unlockError.set(
        (err as { status?: number }).status === 429
          ? 'Too many attempts – please wait a moment.'
          : 'Backend not reachable.',
      );
    }
  }

  protected useThisServer(): void {
    this.form.backend = window.location.origin;
  }

  protected async save(): Promise<void> {
    const current = this.settingsService.value;
    const connectionChanged =
      this.form.backend.trim().replace(/\/+$/, '') !== current.backend ||
      this.form.apiKey !== current.apiKey;

    // A new backend brings its own config and PIN – only store the connection first.
    if (connectionChanged || this.access() === 'offline') {
      this.settingsService.save({
        ...current,
        backend: this.form.backend,
        apiKey: this.form.apiKey,
        station: this.form.station,
        scannerKeyTimeoutMs: this.form.scannerKeyTimeoutMs,
        inputMode: this.form.inputMode,
      });
      this.health.set('unknown');
      await this.checkAccess();
      this.showMessage(
        connectionChanged ? 'Connection saved – settings reloaded.' : 'Saved.',
        true,
      );
      return;
    }

    let pinChange: string | null | undefined;
    if (this.removePin) {
      pinChange = null;
    } else if (this.newPin || this.newPinRepeat) {
      if (this.newPin.length < MIN_PIN_LENGTH) {
        return this.showMessage(`The PIN must have at least ${MIN_PIN_LENGTH} characters.`, false);
      }
      if (this.newPin !== this.newPinRepeat) {
        return this.showMessage('The PINs do not match.', false);
      }
      pinChange = this.newPin;
    }

    const idleHeadlines = this.headlinesText
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
    const clamp = (v: unknown, min: number, max: number) =>
      Math.min(max, Math.max(min, Math.round(Number(v) || 0)));
    try {
      await this.lock.save(
        {
          ...this.form,
          idleHeadlines,
          hatsPer100: clamp(this.form.hatsPer100, 0, 100),
          hatsTotal: clamp(this.form.hatsTotal, 0, 1_000_000),
        },
        pinChange,
      );
    } catch (err) {
      const status = (err as { status?: number }).status;
      return this.showMessage(
        status === 403 ? 'Invalid PIN – please reopen the page.' : 'Backend not reachable.',
        false,
      );
    }
    if (pinChange !== undefined) this.pinSet.set(pinChange !== null);
    this.resetForm();
    this.showMessage(this.isLocal ? 'Saved.' : 'Saved and sent to all stations.', true);
  }

  protected async healthcheck(): Promise<void> {
    if (this.isLocal) {
      this.health.set('local');
      return;
    }
    this.health.set('checking');
    this.health.set((await this.store.healthz()) ? 'healthy' : 'unhealthy');
  }

  protected simulateScan(): void {
    if (this.testCode.trim()) this.lastScan.set(this.testCode.trim());
  }

  protected async loadScans(): Promise<void> {
    this.scansError.set('');
    try {
      this.scans.set((await this.store.list(this.lock.pin())).slice().reverse());
    } catch {
      this.scans.set([]);
      this.scansError.set('Could not load the scans from the backend.');
    }
  }

  protected exportCsv(): void {
    const rows = [['number', 'code', 'winner', 'station', 'timestamp']];
    for (const s of this.scans().slice().reverse()) {
      rows.push([String(s.number), s.code, String(s.winner), s.station ?? '', s.timestamp]);
    }
    const csv = rows.map((r) => r.map((v) => `"${v.replace(/"/g, '""')}"`).join(';')).join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `hat-raffle-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  protected clearLocal(): void {
    if (confirm('Really delete all locally stored scans?')) {
      this.store.clearLocal();
      this.loadScans();
    }
  }

  private resetForm(): void {
    this.form = { ...this.settingsService.value };
    this.headlinesText = this.form.idleHeadlines.join('\n');
    this.newPin = '';
    this.newPinRepeat = '';
    this.removePin = false;
  }

  private showMessage(text: string, ok: boolean): void {
    clearTimeout(this.messageTimer);
    this.message.set({ text, ok });
    this.messageTimer = window.setTimeout(() => this.message.set(null), 4000);
  }
}
