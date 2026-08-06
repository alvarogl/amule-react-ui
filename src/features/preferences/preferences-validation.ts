type PreferenceRecord = Record<string, unknown>;

const enumOptions: Record<string, string[]> = {
  "connection.proxy_type": ["", "socks5", "socks4", "socks4a", "http"],
  "security.shared_files_visibility": ["everybody", "friends", "nobody"],
  "ip2country.source": ["dbip", "maxmind", "custom"],
};

function labelFor(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function isRecord(value: unknown): value is PreferenceRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function numberLimits(path: string) {
  if (path.endsWith("upnp_tcp_port")) return { min: 0, max: 65_535 };
  if (path.endsWith("_port") || path.endsWith(".port")) return { min: 1, max: 65_535 };
  return { min: 0 };
}

export function enumValues(path: string) {
  return enumOptions[path];
}

export function validatePreferences(value: unknown, path = ""): string[] {
  if (isRecord(value))
    return Object.entries(value).flatMap(([key, child]) =>
      validatePreferences(child, path ? `${path}.${key}` : key),
    );
  if (typeof value === "number") {
    const limits = numberLimits(path);
    if (!Number.isFinite(value) || !Number.isInteger(value))
      return [`${labelFor(path)} must be a whole number.`];
    if (value < limits.min || (limits.max !== undefined && value > limits.max))
      return [`${labelFor(path)} must be between ${limits.min} and ${limits.max ?? "∞"}.`];
  }
  if (typeof value === "string" && enumOptions[path] && !enumOptions[path].includes(value))
    return [`${labelFor(path)} has an invalid value.`];
  if (typeof value === "string" && path.endsWith("_url") && value && !isHttpUrl(value))
    return [`${labelFor(path)} must be a valid HTTP or HTTPS URL.`];
  return [];
}

function isHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}
