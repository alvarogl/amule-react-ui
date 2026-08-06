import { useEffect, useState } from "react";

type ThemePreference = "system" | "light" | "dark";

const storageKey = "amule-ui-theme";

function readPreference(): ThemePreference {
  const saved = window.localStorage.getItem(storageKey);
  return saved === "light" || saved === "dark" ? saved : "system";
}

function resolveTheme(preference: ThemePreference) {
  return preference === "system"
    ? window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light"
    : preference;
}

export function ThemeSelect() {
  const [preference, setPreference] = useState<ThemePreference>(readPreference);

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      const theme = resolveTheme(preference);
      document.documentElement.dataset.theme = theme;
      document.documentElement.style.colorScheme = theme;
    };
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [preference]);

  return (
    <label className="theme-select">
      <span>Theme</span>
      <select
        aria-label="Color theme"
        value={preference}
        onChange={(event) => {
          const next = event.target.value as ThemePreference;
          window.localStorage.setItem(storageKey, next);
          setPreference(next);
        }}
      >
        <option value="system">System</option>
        <option value="light">Light</option>
        <option value="dark">Dark</option>
      </select>
    </label>
  );
}
