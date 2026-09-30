import { provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { ScanStoreService } from './scan-store.service';
import { DEFAULT_SETTINGS, SettingsService } from './settings.service';

describe('ScanStoreService (local mode)', () => {
  let store: ScanStoreService;
  let settings: SettingsService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [provideHttpClient()] });
    store = TestBed.inject(ScanStoreService);
    settings = TestBed.inject(SettingsService);
    settings.save({ ...DEFAULT_SETTINGS });
  });

  it('numbers participants and lets prime numbers win', async () => {
    const results = [];
    for (let i = 1; i <= 7; i++) results.push(await store.register(`badge-${i}`));
    expect(results.map((r) => r.record.number)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(results.map((r) => r.record.winner)).toEqual([
      false,
      true,
      true,
      false,
      true,
      false,
      true,
    ]);
  });

  it('detects duplicates and returns the original record', async () => {
    await store.register('A');
    const first = await store.register('B');
    const again = await store.register('  B\n');
    expect(again.status).toBe('duplicate');
    expect(again.record).toEqual(first.record);
    expect((await store.list()).length).toBe(2);
  });

  it('stops handing out hats when the stock is empty', async () => {
    settings.save({ ...DEFAULT_SETTINGS, hatsTotal: 1 });
    await store.register('1');
    const second = await store.register('2'); // prime -> wins the only hat
    const third = await store.register('3'); // prime, but sold out
    expect(second.record.winner).toBe(true);
    expect(third.record.winner).toBe(false);
    expect(third.soldOut).toBe(true);
  });

  it('can check the digits of the code instead of the counter', async () => {
    settings.save({ ...DEFAULT_SETTINGS, winnerRule: 'code' });
    expect((await store.register('ID-0013')).record.winner).toBe(true);
    expect((await store.register('ID-0014')).record.winner).toBe(false);
  });
});
