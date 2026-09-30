import { provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { ConfigLockService } from './config-lock.service';
import { DEFAULT_SETTINGS, SettingsService } from './settings.service';

describe('ConfigLockService (local mode)', () => {
  let lock: ConfigLockService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [provideHttpClient()] });
    lock = TestBed.inject(ConfigLockService);
    TestBed.inject(SettingsService).save({ ...DEFAULT_SETTINGS });
  });

  it('is open until a PIN is set', async () => {
    expect(await lock.isPinSet()).toBe(false);
    await lock.save({ ...DEFAULT_SETTINGS }, '4711');
    expect(await lock.isPinSet()).toBe(true);
  });

  it('only unlocks with the right PIN', async () => {
    await lock.save({ ...DEFAULT_SETTINGS }, '4711');
    lock.lock();
    expect(await lock.unlock('0000')).toBe(false);
    expect(lock.pin()).toBeNull();
    expect(await lock.unlock('4711')).toBe(true);
    expect(lock.pin()).toBe('4711');
  });

  it('can remove the PIN again', async () => {
    await lock.save({ ...DEFAULT_SETTINGS }, '4711');
    await lock.save({ ...DEFAULT_SETTINGS }, null);
    expect(await lock.isPinSet()).toBe(false);
  });
});
