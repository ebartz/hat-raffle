import { Injectable } from '@angular/core';
import confetti from 'canvas-confetti';
import { HAT_BRIM, HAT_CROWN } from './hat-paths';

const COLORS = ['#ee0000', '#ffffff', '#151515', '#a60000', '#f0f0f0'];

/** Confetti bursts in Red Hat colors, including little flying hats. */
@Injectable({ providedIn: 'root' })
export class CelebrationService {
  private hatShape?: confetti.Shape;
  private timers: number[] = [];

  celebrate(durationMs = 5000): void {
    this.stop();
    this.hatShape ??= confetti.shapeFromPath({ path: `${HAT_CROWN} ${HAT_BRIM}` });
    const hat = this.hatShape;
    const end = Date.now() + durationMs;

    // Big opening burst from the center, over the hat.
    confetti({
      particleCount: 160,
      spread: 100,
      startVelocity: 55,
      origin: { y: 0.55 },
      colors: COLORS,
      zIndex: 50,
    });
    confetti({
      particleCount: 25,
      spread: 120,
      startVelocity: 45,
      origin: { y: 0.55 },
      shapes: [hat],
      colors: ['#ee0000'],
      scalar: 2.6,
      zIndex: 50,
    });

    // Continuous side cannons.
    const frame = () => {
      confetti({
        particleCount: 4,
        angle: 60,
        spread: 60,
        origin: { x: 0, y: 0.7 },
        colors: COLORS,
        zIndex: 50,
      });
      confetti({
        particleCount: 4,
        angle: 120,
        spread: 60,
        origin: { x: 1, y: 0.7 },
        colors: COLORS,
        zIndex: 50,
      });
      if (Date.now() < end) this.timers.push(window.setTimeout(frame, 40));
    };
    frame();

    // Hats raining from the top.
    for (let i = 1; i <= 3; i++) {
      this.timers.push(
        window.setTimeout(() => {
          confetti({
            particleCount: 12,
            spread: 180,
            startVelocity: 20,
            gravity: 0.6,
            ticks: 400,
            origin: { x: Math.random() * 0.6 + 0.2, y: -0.1 },
            shapes: [hat],
            colors: ['#ee0000', '#c00000'],
            scalar: 3,
            zIndex: 50,
          });
        }, i * 900),
      );
    }
  }

  stop(): void {
    this.timers.forEach((t) => clearTimeout(t));
    this.timers = [];
    confetti.reset();
  }
}
