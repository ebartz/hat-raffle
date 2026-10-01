import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { HapticsService } from './haptics.service';

describe('HapticsService', () => {
  afterEach(() => vi.unstubAllGlobals());

  function setup(
    vibrate: unknown,
    hasBeenActive: boolean,
    userAgent = 'Mozilla/5.0 (Linux; Android 15; Pixel 9)',
  ) {
    vi.stubGlobal('navigator', {
      ...navigator,
      userAgent,
      maxTouchPoints: 5,
      vibrate,
      userActivation: { hasBeenActive },
    });
    return TestBed.inject(HapticsService);
  }

  it('vibrates with a long pattern for a winner', () => {
    const vibrate = vi.fn(() => true);
    setup(vibrate, true).win();
    expect(vibrate).toHaveBeenCalledWith([300, 100, 300, 100, 600]);
  });

  it('waits for the first touch on Android', () => {
    const vibrate = vi.fn(() => true);
    const haptics = setup(vibrate, false);
    expect(haptics.needsUserGesture).toBe(true);
    haptics.win();
    expect(vibrate).not.toHaveBeenCalled();
  });

  it('plays the pattern as haptic ticks on iPhones (no Vibration API)', () => {
    vi.useFakeTimers();
    const clicks = vi.spyOn(HTMLLabelElement.prototype, 'click');
    setup(undefined, false, 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)').win();
    vi.runAllTimers();
    expect(clicks).toHaveBeenCalledTimes(8);
    expect(document.querySelector('label input[switch]')).not.toBeNull();
    vi.useRealTimers();
  });
});
