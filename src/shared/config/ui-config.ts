const pathValue = (value: string | undefined, fallback: string) =>
  (value || fallback).replace(/\/$/, "");

export const uiConfig = {
  apiBase: pathValue(import.meta.env.VITE_API_BASE, "/api/v1"),
  eventsUrl: pathValue(import.meta.env.VITE_EVENTS_URL, "/api/v1/events"),
};
