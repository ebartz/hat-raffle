import { Routes } from '@angular/router';
import { ConfigComponent } from './config/config.component';
import { KioskComponent } from './kiosk/kiosk.component';

export const routes: Routes = [
  { path: '', component: KioskComponent, title: 'Win a Fedora' },
  { path: 'config', component: ConfigComponent, title: 'Win a Fedora · Konfiguration' },
  { path: '**', redirectTo: '' },
];
