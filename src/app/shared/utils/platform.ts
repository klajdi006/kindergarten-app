/** True when running as an installed PWA on iOS (home-screen / standalone mode). */
export function isIosPwa(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const isStandalone =
    (navigator as { standalone?: boolean }).standalone === true ||
    window.matchMedia?.('(display-mode: standalone)').matches === true;
  return isIos && isStandalone;
}
