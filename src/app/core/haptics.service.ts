import { DOCUMENT, Injectable, inject } from '@angular/core';
import { isAppleMobileDevice } from './device';

type Pattern = number[];

/** Vibration patterns: on/off durations in milliseconds. */
const PATTERNS = {
  tap: [40],
  win: [300, 100, 300, 100, 600],
  warning: [120, 80, 120],
} satisfies Record<string, Pattern>;

/**
 * Vibrates phones and tablets.
 *
 * - Android: Vibration API. Chrome only allows it after the user has touched the page once.
 * - iOS: Safari has no Vibration API. From iOS 18 on, toggling a native switch control gives a
 *   short haptic tick, so a pattern is played as a series of ticks.
 * - Desktops: no-op.
 */
@Injectable({ providedIn: 'root' })
export class HapticsService {
  private readonly document = inject(DOCUMENT);
  private iosSwitch?: HTMLLabelElement;

  /** True when vibration is blocked until the user touches the screen once (Android). */
  get needsUserGesture(): boolean {
    return this.hasVibrationApi && navigator.userActivation?.hasBeenActive === false;
  }

  tap(): void {
    this.play(PATTERNS.tap);
  }

  win(): void {
    this.play(PATTERNS.win);
  }

  warning(): void {
    this.play(PATTERNS.warning);
  }

  private get hasVibrationApi(): boolean {
    return typeof navigator.vibrate === 'function';
  }

  private play(pattern: Pattern): void {
    if (this.hasVibrationApi) {
      if (!this.needsUserGesture) navigator.vibrate(pattern);
      return;
    }
    if (isAppleMobileDevice()) this.playIos(pattern);
  }

  /** One tick per "on" phase; long phases get a few extra ticks so they feel longer. */
  private playIos(pattern: Pattern): void {
    let at = 0;
    pattern.forEach((duration, i) => {
      if (i % 2 === 0) {
        const ticks = Math.max(1, Math.round(duration / 150));
        for (let t = 0; t < ticks; t++) setTimeout(() => this.iosTick(), at + t * 90);
      }
      at += duration;
    });
  }

  private iosTick(): void {
    if (!this.iosSwitch) {
      const label = this.document.createElement('label');
      label.setAttribute('aria-hidden', 'true');
      label.style.cssText = 'position:fixed;left:-9999px;width:1px;height:1px;overflow:hidden';
      const input = this.document.createElement('input');
      input.type = 'checkbox';
      input.setAttribute('switch', '');
      input.tabIndex = -1;
      label.appendChild(input);
      this.document.body.appendChild(label);
      this.iosSwitch = label;
    }
    this.iosSwitch.click();
  }
}
