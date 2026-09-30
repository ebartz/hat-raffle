import { DOCUMENT, Injectable, NgZone, OnDestroy, inject } from '@angular/core';
import { Subject } from 'rxjs';
import { SettingsService } from './settings.service';

const MIN_CODE_LENGTH = 2;

/**
 * Barcode scanners behave like a keyboard: they "type" the code very fast and
 * finish with Enter. Key strokes that come in slower than the configured
 * timeout are treated as normal typing and discarded.
 */
@Injectable({ providedIn: 'root' })
export class ScannerService implements OnDestroy {
  private readonly document = inject(DOCUMENT);
  private readonly settings = inject(SettingsService);
  private readonly zone = inject(NgZone);

  private buffer = '';
  private lastKeyAt = 0;
  private readonly scansSubject = new Subject<string>();
  readonly scans$ = this.scansSubject.asObservable();

  private readonly listener = (event: KeyboardEvent) => this.onKey(event);

  constructor() {
    this.zone.runOutsideAngular(() =>
      this.document.addEventListener('keydown', this.listener, true),
    );
  }

  ngOnDestroy(): void {
    this.document.removeEventListener('keydown', this.listener, true);
  }

  /** Feed a code manually, e.g. from the test field on the config page. */
  emit(code: string): void {
    this.zone.run(() => this.scansSubject.next(code));
  }

  private onKey(event: KeyboardEvent): void {
    const target = event.target as HTMLElement | null;
    if (target?.closest('input, textarea, select, [contenteditable="true"]')) return;

    const now = performance.now();
    if (now - this.lastKeyAt > this.settings.value.scannerKeyTimeoutMs) this.buffer = '';
    this.lastKeyAt = now;

    if (event.key === 'Enter' || event.key === 'Tab') {
      const code = this.buffer;
      this.buffer = '';
      if (code.length >= MIN_CODE_LENGTH) {
        event.preventDefault();
        this.emit(code);
      }
      return;
    }
    if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
      this.buffer += event.key;
    }
  }
}
