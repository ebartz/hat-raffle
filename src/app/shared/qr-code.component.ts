import { ChangeDetectionStrategy, Component, effect, input, signal } from '@angular/core';
import QRCode from 'qrcode';

/** Renders any text as a QR code image. */
@Component({
  selector: 'app-qr-code',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (src()) {
      <img [src]="src()" [alt]="'QR-Code: ' + value()" [width]="size()" [height]="size()" />
    }
  `,
  styles: `
    :host {
      display: inline-block;
      line-height: 0;
    }
    img {
      image-rendering: pixelated;
      background: #fff;
    }
  `,
})
export class QrCodeComponent {
  readonly value = input.required<string>();
  readonly size = input(96);

  protected readonly src = signal('');

  constructor() {
    effect(() => {
      const value = this.value();
      const size = this.size();
      QRCode.toDataURL(value, {
        margin: 1,
        width: size * 2,
        color: { dark: '#151515', light: '#ffffff' },
      })
        .then((url) => this.src.set(url))
        .catch(() => this.src.set(''));
    });
  }
}
