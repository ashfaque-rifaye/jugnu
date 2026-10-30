// Google Maps JavaScript API, loaded once and only when a map asks for it. The key is a browser key
// (restrict it to this site's domains in the Cloud console); without one the maps stay on MapLibre.
/* eslint-disable @typescript-eslint/no-explicit-any */
export const MAPS_KEY = (import.meta.env.VITE_GOOGLE_MAPS_KEY as string | undefined) || "";

let loading: Promise<any> | null = null;
let rejected = false;
const rejectedListeners = new Set<() => void>();

/** Google can refuse a key after the script has loaded, so a map must keep listening. Returns an unsubscribe. */
export function onMapsRejected(fn: () => void) {
  if (rejected) fn();
  rejectedListeners.add(fn);
  return () => void rejectedListeners.delete(fn);
}

export function loadGoogleMaps(language = "en"): Promise<any> {
  if (!MAPS_KEY) return Promise.reject(new Error("No Google Maps key"));
  if (rejected) return Promise.reject(new Error("Google Maps rejected the key"));
  const w = window as any;
  if (w.google?.maps?.importLibrary) return Promise.resolve(w.google.maps);
  loading ??= new Promise((resolve, reject) => {
    w.__jugnuMaps = () => resolve(w.google.maps);
    // A bad or restricted key fails here rather than in a callback.
    w.gm_authFailure = () => {
      rejected = true;
      reject(new Error("Google Maps rejected the key"));
      rejectedListeners.forEach((f) => f());
    };
    const s = document.createElement("script");
    s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(MAPS_KEY)}&v=beta&loading=async&language=${language}&region=IN&callback=__jugnuMaps`;
    s.async = true;
    s.onerror = () => {
      loading = null;
      reject(new Error("Google Maps did not load"));
    };
    document.head.append(s);
  });
  return loading;
}
