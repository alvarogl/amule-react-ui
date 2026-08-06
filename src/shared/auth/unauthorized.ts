export const unauthorizedEvent = "amule:unauthorized";

export function notifyUnauthorized() {
  window.dispatchEvent(new Event(unauthorizedEvent));
}
