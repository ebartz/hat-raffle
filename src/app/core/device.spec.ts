import { isMobileDevice } from './device';

const nav = (userAgent: string, maxTouchPoints = 0) => ({ userAgent, maxTouchPoints }) as Navigator;

describe('isMobileDevice', () => {
  it('detects phones and tablets', () => {
    expect(isMobileDevice(nav('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)'))).toBe(
      true,
    );
    expect(isMobileDevice(nav('Mozilla/5.0 (Linux; Android 15; Pixel 9)'))).toBe(true);
    expect(isMobileDevice(nav('Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)'))).toBe(true);
    // iPadOS desktop mode
    expect(isMobileDevice(nav('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 5))).toBe(true);
  });

  it('treats desktops as scanner stations', () => {
    expect(isMobileDevice(nav('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)'))).toBe(false);
    expect(isMobileDevice(nav('Mozilla/5.0 (Windows NT 10.0; Win64; x64)'))).toBe(false);
    expect(isMobileDevice(nav('Mozilla/5.0 (X11; Linux x86_64)'))).toBe(false);
  });
});
