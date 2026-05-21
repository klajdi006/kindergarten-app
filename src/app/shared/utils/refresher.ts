/**
 * Complete an `<ion-refresher>` after a short delay. Our data is from live
 * Firestore listeners so there's nothing to actually re-fetch — the refresher
 * gesture is acknowledged with a brief spinner before completing.
 */
export function completeRefresher(event: Event, delay = 700): void {
  setTimeout(() => {
    (event.target as HTMLIonRefresherElement | null)?.complete();
  }, delay);
}
