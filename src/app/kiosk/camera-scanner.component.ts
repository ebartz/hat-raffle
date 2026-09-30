import {
  Component,
  ElementRef,
  NgZone,
  OnDestroy,
  OnInit,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import type { IScannerControls } from '@zxing/browser';
import { I18nService } from '../core/i18n.service';

/**
 * The same code is ignored while it stays in front of the camera and until it has been out of
 * view for this long, so a badge held up a bit longer is not sent twice.
 */
const SAME_CODE_PAUSE_MS = 4000;

type CameraState = 'starting' | 'running' | 'insecure' | 'denied' | 'error';

/** Scans QR and barcodes with the (back) camera of a phone or tablet. */
@Component({
  selector: 'app-camera-scanner',
  imports: [FormsModule],
  templateUrl: './camera-scanner.component.html',
  styleUrl: './camera-scanner.component.scss',
})
export class CameraScannerComponent implements OnInit, OnDestroy {
  protected readonly i18n = inject(I18nService);
  private readonly zone = inject(NgZone);

  /** Only emit codes while active (e.g. not while a result is shown). */
  readonly active = input(true);
  readonly scanned = output<string>();

  protected readonly video = viewChild.required<ElementRef<HTMLVideoElement>>('video');
  protected readonly state = signal<CameraState>('starting');
  protected readonly flash = signal(false);
  protected manualCode = '';

  private controls?: IScannerControls;
  private lastCode = '';
  private lastCodeAt = 0;
  private destroyed = false;

  ngOnInit(): void {
    this.start();
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    this.controls?.stop();
  }

  protected async start(): Promise<void> {
    this.controls?.stop();
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      this.state.set('insecure');
      return;
    }
    this.state.set('starting');
    try {
      const { BrowserMultiFormatReader } = await import('@zxing/browser');
      const reader = new BrowserMultiFormatReader(undefined, { delayBetweenScanAttempts: 150 });
      const controls = await reader.decodeFromConstraints(
        { audio: false, video: { facingMode: { ideal: 'environment' } } },
        this.video().nativeElement,
        (result) => {
          if (result) this.zone.run(() => this.onCode(result.getText()));
        },
      );
      if (this.destroyed) {
        controls.stop();
        return;
      }
      this.controls = controls;
      this.state.set('running');
    } catch (err) {
      console.error('Camera could not be started', err);
      this.state.set((err as Error)?.name === 'NotAllowedError' ? 'denied' : 'error');
    }
  }

  protected submitManual(): void {
    const code = this.manualCode.trim();
    if (!code) return;
    this.manualCode = '';
    this.scanned.emit(code);
  }

  private onCode(code: string): void {
    if (!code) return;
    const now = Date.now();
    const repeated = code === this.lastCode && now - this.lastCodeAt < SAME_CODE_PAUSE_MS;
    if (code === this.lastCode) this.lastCodeAt = now;
    if (!this.active() || repeated) return;
    this.lastCode = code;
    this.lastCodeAt = now;
    this.flash.set(true);
    setTimeout(() => this.flash.set(false), 300);
    if (navigator.userActivation?.hasBeenActive) navigator.vibrate?.(80);
    this.scanned.emit(code);
  }
}
