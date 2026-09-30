import { Routes } from '@angular/router';
import { ConfigComponent } from './config/config.component';
import { KioskComponent } from './kiosk/kiosk.component';

export const routes: Routes = [
  { path: '', component: KioskComponent, title: 'Hat Raffle' },
  { path: 'config', component: ConfigComponent, title: 'Hat Raffle · Konfiguration' },
  { path: '**', redirectTo: '' },
];
