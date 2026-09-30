import {
  ApplicationConfig,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter, withHashLocation } from '@angular/router';

import { routes } from './app.routes';
import { detectBackend } from './core/auto-backend';
import { SettingsService } from './core/settings.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideHttpClient(),
    // Hash routing so the static build works from any web server or file share without rewrites.
    provideRouter(routes, withHashLocation()),
    provideAppInitializer(() => detectBackend(inject(SettingsService))),
  ],
};
