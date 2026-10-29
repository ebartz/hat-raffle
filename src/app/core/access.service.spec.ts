import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { AccessService } from './access.service';
import { BackendService } from './backend.service';
import { DEFAULT_SETTINGS, SettingsService } from './settings.service';

const BACKEND = 'https://raffle.example.com';

describe('AccessService', () => {
  let http: HttpTestingController;
  let settings: SettingsService;

  const setup = (backendPin = '') => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    settings = TestBed.inject(SettingsService);
    settings.save({ ...DEFAULT_SETTINGS, backend: BACKEND, backendPin });
    http = TestBed.inject(HttpTestingController);
    const access = TestBed.inject(AccessService);
    TestBed.tick();
    return access;
  };
  const flush = () => new Promise((r) => setTimeout(r));

  afterEach(() => http.verify());

  it('is open when the backend has no password', async () => {
    const access = setup();
    http.expectOne(`${BACKEND}/api/access`).flush({ pinSet: false });
    await flush();
    expect(access.state()).toBe('open');
  });

  it('asks for the password and stores it once it is right', async () => {
    const access = setup();
    http.expectOne(`${BACKEND}/api/access`).flush({ pinSet: true });
    await flush();
    expect(access.state()).toBe('password');

    const wrong = access.unlock('nope');
    http
      .expectOne(`${BACKEND}/api/config/unlock`)
      .flush({ error: 'invalid pin' }, { status: 403, statusText: 'Forbidden' });
    expect(await wrong).toBe('wrong');
    expect(settings.value.backendPin).toBe('');

    const right = access.unlock('4711');
    const req = http.expectOne(`${BACKEND}/api/config/unlock`);
    expect(req.request.headers.get('X-Config-Pin')).toBe('4711');
    req.flush({ ok: true });
    expect(await right).toBe('ok');
    expect(access.state()).toBe('open');
    expect(settings.value.backendPin).toBe('4711');
  });

  it('sends the stored password and forgets it when the backend rejects it', async () => {
    const access = setup('4711');
    http.expectOne(`${BACKEND}/api/access`).flush({ pinSet: true });
    await flush();
    http.expectOne(`${BACKEND}/api/config/unlock`).flush({ ok: true });
    await flush();
    expect(access.state()).toBe('open');

    const stats = TestBed.inject(BackendService).get('/api/stats');
    const req = http.expectOne(`${BACKEND}/api/stats`);
    expect(req.request.headers.get('X-Config-Pin')).toBe('4711');
    // The PIN was changed on another station.
    req.flush({ error: 'invalid pin' }, { status: 403, statusText: 'Forbidden' });
    await expect(stats).rejects.toBeTruthy();
    expect(access.state()).toBe('password');
    expect(settings.value.backendPin).toBe('');
  });
});
