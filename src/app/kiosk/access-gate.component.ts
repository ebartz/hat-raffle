import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AccessService } from '../core/access.service';
import { SettingsService } from '../core/settings.service';
import { HatComponent } from '../shared/hat.component';

/** Asks for the backend password before a new device may scan. Shown to the booth staff. */
@Component({
  selector: 'app-access-gate',
  imports: [FormsModule, RouterLink, HatComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="gate" role="dialog" aria-modal="true" aria-labelledby="gate-title">
      <form class="card" (ngSubmit)="submit()">
        <app-hat class="hat" [shadow]="false" />
        <h1 id="gate-title">Password required</h1>
        <p>
          The backend <code>{{ backend }}</code> is protected. Enter its password once to use this
          device as a scan station.
        </p>
        <input
          name="pin"
          type="password"
          [(ngModel)]="pin"
          autocomplete="current-password"
          placeholder="Password"
          aria-label="Password"
          autofocus
        />
        <button type="submit" class="submit" [disabled]="!pin || busy()">
          {{ busy() ? 'Checking …' : 'Connect' }}
        </button>
        @if (error()) {
          <p class="error">{{ error() }}</p>
        }
        <a class="settings" routerLink="/config">Change the connection in the settings</a>
      </form>
    </div>
  `,
  styles: `
    @use '../../theme' as *;

    .gate {
      position: fixed;
      inset: 0;
      z-index: 50;
      display: grid;
      place-items: center;
      padding: 1rem;
      background: rgba(21, 21, 21, 0.92);
    }
    .card {
      display: flex;
      flex-direction: column;
      gap: 1rem;
      width: 100%;
      max-width: 440px;
      padding: 2rem;
      color: $rh-black;
      text-align: center;
      background: $rh-white;
      border-top: 4px solid $rh-red;
    }
    .hat {
      width: 72px;
      margin: 0 auto;
    }
    h1 {
      margin: 0;
      font-family: $font-display;
      font-size: 1.8rem;
    }
    p {
      margin: 0;
      line-height: 1.5;
    }
    code {
      word-break: break-all;
    }
    input {
      padding: 0.7rem 0.9rem;
      font: inherit;
      font-size: 1.1rem;
      border: 1px solid $rh-gray-60;
    }
    .submit {
      padding: 0.8rem 1rem;
      color: $rh-white;
      font: inherit;
      font-weight: 600;
      background: $rh-red;
      border: 0;
      cursor: pointer;

      &:disabled {
        opacity: 0.5;
        cursor: default;
      }
    }
    .error {
      color: $rh-red;
      font-weight: 600;
    }
    .settings {
      color: $rh-gray-60;
      font-size: 0.9rem;
    }
  `,
})
export class AccessGateComponent {
  private readonly access = inject(AccessService);
  protected readonly backend = inject(SettingsService).value.backend;
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  protected pin = '';

  protected async submit(): Promise<void> {
    this.busy.set(true);
    this.error.set('');
    const result = await this.access.unlock(this.pin);
    this.busy.set(false);
    if (result === 'ok') return;
    this.error.set(
      {
        wrong: 'Wrong password.',
        locked: 'Too many attempts – please wait a moment.',
        offline: 'Backend not reachable.',
      }[result],
    );
  }
}
