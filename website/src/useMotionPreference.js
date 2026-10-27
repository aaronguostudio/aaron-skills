import { useSyncExternalStore } from "react";

const query = "(prefers-reduced-motion: reduce)";

function subscribe(onChange) {
  const media = window.matchMedia(query);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

function getSnapshot() {
  return window.matchMedia(query).matches;
}

// SVG path drawing and replay controls must also update when the system setting
// changes while the page is open, rather than only sampling it at mount.
export function useMotionPreference() {
  return useSyncExternalStore(subscribe, getSnapshot, () => true);
}
