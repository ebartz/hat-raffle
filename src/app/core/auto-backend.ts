import { SettingsService } from './settings.service';

/**
 * On the very first start of a device: if the app is served by the Hat Raffle backend,
 * use it automatically. Opening the backend URL on a phone is then all it takes.
 */
export async function detectBackend(settings: SettingsService): Promise<void> {
  if (!settings.isFirstStart) return;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 1500);
  try {
    const res = await fetch(`${location.origin}/healthz`, { signal: controller.signal });
    const body = res.ok ? await res.json() : null;
    if (body?.app === 'hat-raffle') settings.save({ ...settings.value, backend: location.origin });
  } catch {
    // Not served by the backend (e.g. dev server): stay in local mode.
  } finally {
    clearTimeout(timer);
  }
}
