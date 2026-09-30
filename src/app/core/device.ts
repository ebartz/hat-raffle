/** Phones and tablets (iPhone, iPad, Android). iPadOS reports itself as a Mac with touch. */
export function isMobileDevice(nav: Navigator = navigator): boolean {
  const ua = nav.userAgent ?? '';
  if (/iPhone|iPad|iPod|Android/i.test(ua)) return true;
  return /Macintosh/.test(ua) && (nav.maxTouchPoints ?? 0) > 1;
}
