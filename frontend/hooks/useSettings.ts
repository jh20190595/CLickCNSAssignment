import { useCallback, useSyncExternalStore } from "react";
import {
  AppSettings,
  DEFAULT_SETTINGS,
  getSettings,
  saveSettings,
  subscribeSettings,
} from "@/lib/settings";

function subscribe(cb: () => void): () => void {
  return subscribeSettings(cb);
}

export function useSettings(): [AppSettings, (next: AppSettings) => void] {
  const settings = useSyncExternalStore(
    subscribe,
    getSettings,
    () => DEFAULT_SETTINGS,
  );

  const update = useCallback((next: AppSettings) => {
    saveSettings(next);
  }, []);

  return [settings, update];
}
