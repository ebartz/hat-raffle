import { DatePipe } from '@angular/common';
import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { ScanRecord } from '../core/models';
import { ScanStoreService } from '../core/scan-store.service';
import { ScannerService } from '../core/scanner.service';
import { Settings, SettingsService } from '../core/settings.service';
import { HatComponent } from '../shared/hat.component';

type Health = 'unknown' | 'checking' | 'healthy' | 'unhealthy' | 'local';

@Component({
  selector: 'app-config',
  imports: [FormsModule, RouterLink, DatePipe, HatComponent],
  templateUrl: './config.component.html',
  styleUrl: './config.component.scss',
})
export class ConfigComponent implements OnInit, OnDestroy {
  private readonly settingsService = inject(SettingsService);
  private readonly store = inject(ScanStoreService);
  private readonly scanner = inject(ScannerService);

  protected form: Settings = { ...this.settingsService.value };
  protected readonly saved = signal(false);
  protected readonly health = signal<Health>('unknown');
  protected readonly lastScan = signal('');
  protected readonly scans = signal<ScanRecord[]>([]);
  protected readonly scansError = signal('');
  protected testCode = '';

  private sub?: Subscription;

  ngOnInit(): void {
    this.sub = this.scanner.scans$.subscribe((code) => this.lastScan.set(code));
    this.loadScans();
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  protected get isLocal(): boolean {
    return this.settingsService.useLocal;
  }

  protected useThisServer(): void {
    this.form.backend = window.location.origin;
  }

  protected save(): void {
    this.settingsService.save(this.form);
    this.form = { ...this.settingsService.value };
    this.saved.set(true);
    setTimeout(() => this.saved.set(false), 2500);
    this.health.set('unknown');
    this.loadScans();
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
      this.scans.set((await this.store.list()).slice().reverse());
    } catch {
      this.scans.set([]);
      this.scansError.set('Einträge konnten nicht vom Backend geladen werden.');
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
    if (confirm('Alle lokal gespeicherten Scans wirklich löschen?')) {
      this.store.clearLocal();
      this.loadScans();
    }
  }
}
