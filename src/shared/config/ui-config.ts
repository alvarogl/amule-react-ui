const pathValue = (value: string | undefined, fallback: string) =>
  (value || fallback).replace(/\/$/, "");

export const uiConfig = {
  apiBase: pathValue(import.meta.env.VITE_API_BASE, "/api/v0"),
  eventsUrl: pathValue(import.meta.env.VITE_EVENTS_URL, "/api/v0/events"),
};
