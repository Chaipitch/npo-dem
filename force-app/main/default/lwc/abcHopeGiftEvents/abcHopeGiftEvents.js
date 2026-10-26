/**
 * "Gifts changed" signal shared by the ABC Hope site components. A finished donation or a change to a
 * recurring gift calls markGiftsChanged(); components with cached (cacheable Apex) data compare
 * giftsChangedAt() with when they last loaded and refresh, even after moving to another page.
 */
const KEY = "abchope:giftsChangedAt";
export const GIFTS_CHANGED = "abchope:giftschange";

export function markGiftsChanged() {
  try {
    sessionStorage.setItem(KEY, String(Date.now()));
  } catch {
    // storage blocked: same-page listeners still get the event
  }
  window.dispatchEvent(new CustomEvent(GIFTS_CHANGED));
}

/** Time (ms) of the last change in this browser tab; 0 when none. */
export function giftsChangedAt() {
  try {
    return Number(sessionStorage.getItem(KEY)) || 0;
  } catch {
    return 0;
  }
}
