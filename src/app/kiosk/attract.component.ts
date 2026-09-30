import { Component, OnDestroy, OnInit, computed, inject, input, signal } from '@angular/core';
import { I18nService } from '../core/i18n.service';
import { SettingsService } from '../core/settings.service';
import { HatComponent } from '../shared/hat.component';

interface FloatingHat {
  left: number;
  size: number;
  duration: number;
  delay: number;
  drift: number;
}

/** Full-screen attract loop that is shown while nobody is using the booth. */
@Component({
  selector: 'app-attract',
  imports: [HatComponent],
  templateUrl: './attract.component.html',
  styleUrl: './attract.component.scss',
})
export class AttractComponent implements OnInit, OnDestroy {
  protected readonly i18n = inject(I18nService);
  protected readonly settings = inject(SettingsService).settings;

  readonly winners = input(0);
  readonly hatsLeft = input<number | null>(null);

  protected readonly headlineIndex = signal(0);

  /** Texts from the config page win over the built-in defaults. */
  protected readonly headlines = computed(() => {
    const custom = this.settings()
      .idleHeadlines.map((h) => h.trim())
      .filter(Boolean);
    return custom.length ? custom : [...this.i18n.texts().idleHeadlines];
  });
  protected readonly subline = computed(() => {
    const custom = this.settings().idleSubline.trim();
    if (custom) return custom;
    const rule = this.settings().winnerRule;
    return this.i18n.t(
      rule === 'code' ? 'idleRuleCode' : rule === 'random' ? 'idleRuleRandom' : 'idleRuleCounter',
    );
  });
  protected readonly cta = computed(() => this.settings().idleCta.trim() || this.i18n.t('idleCta'));
  protected readonly floatingHats: FloatingHat[] = Array.from({ length: 14 }, () => ({
    left: Math.random() * 100,
    size: 40 + Math.random() * 90,
    duration: 9 + Math.random() * 10,
    delay: -Math.random() * 18,
    drift: (Math.random() - 0.5) * 160,
  }));

  private interval?: number;

  ngOnInit(): void {
    this.interval = window.setInterval(() => {
      this.headlineIndex.update((i) => (i + 1) % this.headlines().length);
    }, 3200);
  }

  ngOnDestroy(): void {
    clearInterval(this.interval);
  }
}
