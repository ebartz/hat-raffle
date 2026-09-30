import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { RealtimeService } from './core/realtime.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  template: '<router-outlet />',
})
export class App {
  // Started here so config and counters stay in sync on every page.
  private readonly realtime = inject(RealtimeService);
}
