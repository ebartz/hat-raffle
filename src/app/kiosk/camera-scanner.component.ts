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
import { HapticsService } from '../core/haptics.service';
import { I18nService } from '../core/i18n.service';
import { BarcodeDecoder, createDecoder } from './barcode-decoder';

/**
 * The same code is ignored while it stays in front of the camera and until it has been out of
 * view for this long, so a badge held up a bit longer is not sent twice.
 */
const SAME_CODE_PAUSE_MS = 4000;
/** Pause between two decode attempts. Each attempt takes only a few milliseconds. */
const SCAN_INTERVAL_MS = 40;

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
  private readonly haptics = inject(HapticsService);

  /** Only emit codes while active (e.g. not while a result is shown). */
  readonly active = input(true);
  readonly scanned = output<string>();

  protected readonly video = viewChild.required<ElementRef<HTMLVideoElement>>('video');
  protected readonly state = signal<CameraState>('starting');
  protected readonly flash = signal(false);
  protected manualCode = '';

  private stream?: MediaStream;
  private decoder?: BarcodeDecoder;
  private loopTimer?: number;
  private lastCode = '';
  private lastCodeAt = 0;
  private destroyed = false;

  ngOnInit(): void {
    this.start();
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    this.stop();
  }

  protected async start(): Promise<void> {
    this.stop();
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      this.state.set('insecure');
      return;
    }
    this.state.set('starting');
    try {
      const [stream, decoder] = await Promise.all([this.openCamera(), createDecoder()]);
      if (this.destroyed) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      this.stream = stream;
      this.decoder = decoder;
      const video = this.video().nativeElement;
      video.srcObject = stream;
      await video.play();
      this.state.set('running');
      this.zone.runOutsideAngular(() => this.scanLoop());
    } catch (err) {
      console.error('Camera could not be started', err);
      this.stop();
      this.state.set((err as Error)?.name === 'NotAllowedError' ? 'denied' : 'error');
    }
  }

  /**
   * Back camera in HD: small QR codes on badges need the extra pixels. Continuous autofocus is
   * requested where the browser supports it (otherwise many phones keep a fixed focus).
   */
  private async openCamera(): Promise<MediaStream> {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        facingMode: { ideal: 'environment' },
        width: { ideal: 1920 },
        height: { ideal: 1080 },
      },
    });
    const track = stream.getVideoTracks()[0];
    const caps = (track.getCapabilities?.() ?? {}) as { focusMode?: string[] };
    if (caps.focusMode?.includes('continuous')) {
      await track
        .applyConstraints({ advanced: [{ focusMode: 'continuous' } as MediaTrackConstraintSet] })
        .catch(() => undefined);
    }
    return stream;
  }

  private async scanLoop(): Promise<void> {
    const video = this.video().nativeElement;
    while (this.stream && !this.destroyed) {
      // Keeps decoding while a result is shown, so a badge that stays in view is not re-sent.
      if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
        try {
          const code = await this.decoder?.decode(video);
          if (code) this.zone.run(() => this.onCode(code));
        } catch (err) {
          console.warn('Decoding failed', err);
        }
      }
      await new Promise((r) => (this.loopTimer = window.setTimeout(r, SCAN_INTERVAL_MS)));
    }
  }

  private stop(): void {
    clearTimeout(this.loopTimer);
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = undefined;
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
    this.haptics.tap();
    this.scanned.emit(code);
  }
}
