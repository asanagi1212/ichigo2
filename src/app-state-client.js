import {
  buildServerSettingsPayload,
  mergeServerSettings,
  saveSettings
} from "./storage.js";

async function parseJson(response) {
  return response.json().catch(() => ({}));
}

export async function fetchAppState(localSettings) {
  const response = await fetch("/api/app-state");
  const data = await parseJson(response);

  if (!response.ok) {
    throw new Error(data.error || `Failed to load app state: ${response.status}`);
  }

  const merged = mergeServerSettings(localSettings, data.settings || {});
  saveSettings(merged);

  return {
    settings: merged,
    memories: Array.isArray(data.memories) ? data.memories : []
  };
}

export async function persistAppState(settings) {
  const response = await fetch("/api/app-state", {
    method: "PUT",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      settings: buildServerSettingsPayload(settings)
    })
  });

  const data = await parseJson(response);

  if (!response.ok) {
    throw new Error(data.error || `Failed to save app state: ${response.status}`);
  }

  const merged = mergeServerSettings(settings, data.settings || {});
  saveSettings(merged);
  return merged;
}
