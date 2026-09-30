import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { HAT_BAND, HAT_BRIM, HAT_CROWN, HAT_HIGHLIGHT } from './hat-paths';

let nextId = 0;

@Component({
  selector: 'app-hat',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg viewBox="0 0 200 120" role="img" [attr.aria-label]="label()">
      <defs>
        <linearGradient [attr.id]="id + 'crown'" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stop-color="#ff3b3b" />
          <stop offset="0.55" stop-color="#ee0000" />
          <stop offset="1" stop-color="#a60000" />
        </linearGradient>
        <linearGradient [attr.id]="id + 'brim'" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stop-color="#ee0000" />
          <stop offset="1" stop-color="#8f0000" />
        </linearGradient>
      </defs>
      @if (shadow()) {
        <ellipse cx="100" cy="114" rx="80" ry="5" fill="rgba(0,0,0,.25)" />
      }
      <path [attr.d]="brim" [attr.fill]="'url(#' + id + 'brim)'" />
      <path [attr.d]="crown" [attr.fill]="'url(#' + id + 'crown)'" />
      <path [attr.d]="band" fill="#151515" />
      <path [attr.d]="highlight" fill="rgba(255,255,255,.18)" />
    </svg>
  `,
  styles: `
    :host {
      display: inline-block;
      line-height: 0;
    }
    svg {
      width: 100%;
      height: auto;
      overflow: visible;
    }
  `,
})
export class HatComponent {
  readonly shadow = input(true);
  readonly label = input('Fedora');

  protected readonly id = `hat${nextId++}-`;
  protected readonly crown = HAT_CROWN;
  protected readonly brim = HAT_BRIM;
  protected readonly band = HAT_BAND;
  protected readonly highlight = HAT_HIGHLIGHT;
}
