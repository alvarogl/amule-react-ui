import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { KeyRound, RefreshCw, RotateCcw, Save, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/shared/api/amule-api";
import { queryKeys } from "@/shared/api/query-keys";
import { QueryNotice } from "@/shared/components/QueryNotice";
import { getErrorMessage } from "@/shared/lib/errors";
import {
  enumValues,
  numberLimits,
  validatePreferences,
} from "@/features/preferences/preferences-validation";

type Preferences = Record<string, unknown>;

function VersionChecker() {
  const client = useQueryClient();
  const lastCheckedBeforeRequest = useRef<number | null>(null);
  const [waitingForResult, setWaitingForResult] = useState(false);
  const version = useQuery({
    queryKey: queryKeys.version,
    queryFn: api.version,
    retry: false,
    refetchInterval: waitingForResult ? 3_000 : false,
  });
  useEffect(() => {
    const lastChecked = version.data?.update.last_checked;
    if (
      waitingForResult &&
      lastChecked !== null &&
      lastChecked !== undefined &&
      lastChecked !== lastCheckedBeforeRequest.current
    ) {
      setWaitingForResult(false);
      toast.success("Version check completed.");
    }
  }, [version.data?.update.last_checked, waitingForResult]);
  const check = useMutation({
    mutationFn: api.checkVersion,
    onSuccess: () => {
      lastCheckedBeforeRequest.current = version.data?.update.last_checked ?? null;
      setWaitingForResult(true);
      void client.invalidateQueries({ queryKey: queryKeys.version });
    },
    onError: (error) => {
      setWaitingForResult(false);
      toast.error(getErrorMessage(error));
    },
  });
  if (!version.data?.update.check_enabled) return null;
  const update = version.data.update;
  const state = update.update_available
    ? `Version ${update.latest_version} is available`
    : update.checked
      ? "aMule is up to date"
      : "No version check has completed yet";
  return (
    <section
      className={`panel version-checker ${update.update_available ? "version-checker--available" : ""}`}
    >
      <div>
        <strong>Software updates</strong>
        <span>{state}</span>
        <small>Running {version.data.daemon_version || version.data.amule_version}</small>
      </div>
      <button
        className="muted"
        disabled={check.isPending || waitingForResult}
        onClick={() => check.mutate()}
      >
        <RefreshCw size={15} /> Check now
      </button>
    </section>
  );
}

const readOnlyKeys = new Set([
  "user_hash",
  "mmap_supported",
  "upnp_available",
  "supported",
  "loaded_source",
  "db_path",
  "db_loaded",
  "download_in_progress",
  "last_update_result",
]);
const hiddenKeys = new Set(["password", "guest_password", "proxy_password"]);
const restartKeys = new Set([
  "connection.bind_address",
  "connection.bind_interface",
  "remote_controls.amuleapi.port",
  "remote_controls.amuleapi.bind_address",
  "directories.incoming",
  "directories.temp",
]);
const basicPreferenceFields: Record<string, string[]> = {
  general: ["nickname", "local_host_name", "check_new_version"],
  connection: [
    "max_upload_kbps",
    "max_download_kbps",
    "upload_slot_kbps",
    "tcp_port",
    "udp_port",
    "max_sources_per_file",
    "max_connections",
    "autoconnect",
    "reconnect",
    "network_ed2k",
    "network_kad",
    "upnp_enabled",
  ],
  directories: ["incoming", "temp", "auto_rescan", "follow_symlinks"],
  files: [
    "add_new_downloads_paused",
    "new_downloads_auto_priority",
    "prioritize_first_last_chunks",
    "preallocate_full_file_size",
    "stop_on_low_disk_space",
    "min_free_space_mb",
  ],
  servers: ["remove_dead", "auto_update", "use_priority_system", "safe_connect", "update_url"],
  security: [
    "shared_files_visibility",
    "ipfilter_clients",
    "ipfilter_servers",
    "obfuscation_enabled",
  ],
};

function labelFor(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function diff(base: unknown, value: unknown): unknown {
  if (Array.isArray(base) && Array.isArray(value))
    return JSON.stringify(base) === JSON.stringify(value) ? undefined : value;
  if (isRecord(base) && isRecord(value)) {
    const result: Record<string, unknown> = {};
    for (const key of Object.keys(value)) {
      const changed = diff(base[key], value[key]);
      if (changed !== undefined) result[key] = changed;
    }
    return Object.keys(result).length ? result : undefined;
  }
  return Object.is(base, value) ? undefined : value;
}

function changedPaths(base: unknown, value: unknown, prefix = ""): string[] {
  if (!isRecord(base) || !isRecord(value)) return Object.is(base, value) ? [] : [prefix];
  return Object.keys(value).flatMap((key) =>
    changedPaths(base[key], value[key], prefix ? `${prefix}.${key}` : key),
  );
}

function PreferenceField({
  fieldKey,
  value,
  path,
  onChange,
}: {
  fieldKey: string;
  value: unknown;
  path: string;
  onChange: (value: unknown) => void;
}) {
  if (hiddenKeys.has(fieldKey)) return null;
  const readOnly = readOnlyKeys.has(fieldKey);
  const id = `preference-${path}`;
  if (typeof value === "boolean")
    return (
      <label className="preference-toggle" htmlFor={id}>
        <input
          id={id}
          type="checkbox"
          checked={value}
          disabled={readOnly}
          onChange={(event) => onChange(event.target.checked)}
        />
        <span>{labelFor(fieldKey)}</span>
        {readOnly && <em>Read only</em>}
      </label>
    );
  if (typeof value === "number") {
    const limits = numberLimits(path);
    return (
      <label className="preference-field" htmlFor={id}>
        <span>{labelFor(fieldKey)}</span>
        <input
          id={id}
          type="number"
          value={value}
          min={limits.min}
          max={limits.max}
          step="1"
          readOnly={readOnly}
          onChange={(event) => onChange(Number(event.target.value))}
        />
      </label>
    );
  }
  if (Array.isArray(value))
    return (
      <label className="preference-field" htmlFor={id}>
        <span>
          {labelFor(fieldKey)} <small>One entry per line</small>
        </span>
        <textarea
          id={id}
          value={value.join("\n")}
          readOnly={readOnly}
          onChange={(event) => onChange(event.target.value.split("\n").filter(Boolean))}
        />
      </label>
    );
  const options = enumValues(path);
  if (options)
    return (
      <label className="preference-field" htmlFor={id}>
        <span>{labelFor(fieldKey)}</span>
        <select
          id={id}
          value={String(value ?? "")}
          disabled={readOnly}
          onChange={(event) => onChange(event.target.value)}
        >
          {options.map((option) => (
            <option key={option} value={option}>
              {option || "Disabled"}
            </option>
          ))}
        </select>
      </label>
    );
  return (
    <label className="preference-field" htmlFor={id}>
      <span>{labelFor(fieldKey)}</span>
      <input
        id={id}
        value={String(value ?? "")}
        readOnly={readOnly}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function PreferenceGroup({
  title,
  value,
  draft,
  visibleFields,
  onChange,
}: {
  title: string;
  value: Record<string, unknown>;
  draft: Record<string, unknown>;
  visibleFields?: string[];
  onChange: (key: string, value: unknown) => void;
}) {
  const entries = Object.entries(value).filter(
    ([key]) => !visibleFields || visibleFields.includes(key),
  );
  if (!entries.length) return null;
  return (
    <section className="panel preference-group">
      <div className="panel-title">
        <h2>{labelFor(title)}</h2>
      </div>
      <div className="preference-fields">
        {entries.map(([key, item]) =>
          isRecord(item) ? (
            <div className="preference-subgroup" key={key}>
              <h3>{labelFor(key)}</h3>
              {Object.keys(item).map((childKey) => (
                <PreferenceField
                  key={childKey}
                  fieldKey={childKey}
                  path={`${title}.${key}.${childKey}`}
                  value={(draft[key] as Record<string, unknown>)[childKey]}
                  onChange={(next) =>
                    onChange(key, {
                      ...(draft[key] as Record<string, unknown>),
                      [childKey]: next,
                    })
                  }
                />
              ))}
            </div>
          ) : (
            <PreferenceField
              key={key}
              fieldKey={key}
              path={`${title}.${key}`}
              value={draft[key]}
              onChange={(next) => onChange(key, next)}
            />
          ),
        )}
      </div>
    </section>
  );
}

function PasswordManager() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [guestPassword, setGuestPassword] = useState("");
  const [guestEnabled, setGuestEnabled] = useState<boolean | undefined>();
  const client = useQueryClient();
  const status = useQuery({ queryKey: queryKeys.passwordStatus, queryFn: api.passwordStatus });
  const save = useMutation({
    mutationFn: () =>
      api.patchPasswords({
        current_password: currentPassword,
        ...(adminPassword ? { admin_password: adminPassword } : {}),
        ...(guestPassword ? { guest_password: guestPassword } : {}),
        ...(resolvedGuestEnabled !== status.data?.guest_enabled
          ? { guest_enabled: resolvedGuestEnabled }
          : {}),
      }),
    onSuccess: () => {
      setCurrentPassword("");
      setAdminPassword("");
      setGuestPassword("");
      setGuestEnabled(undefined);
      void client.invalidateQueries({ queryKey: queryKeys.passwordStatus });
      toast.success("Credential settings updated. Other sessions were signed out.");
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
  const resolvedGuestEnabled = guestEnabled ?? status.data?.guest_enabled ?? false;
  const hasChange = Boolean(
    adminPassword || guestPassword || resolvedGuestEnabled !== status.data?.guest_enabled,
  );
  return (
    <section className="panel preference-group password-manager">
      <div className="panel-title">
        <h2>
          <KeyRound size={17} /> API credentials
        </h2>
        <span>Write-only</span>
      </div>
      {status.isPending || status.isError ? (
        <QueryNotice
          loading={status.isPending}
          error={status.error}
          onRetry={() => void status.refetch()}
        />
      ) : (
        <div className="preference-fields">
          <p className="preference-help">
            Passwords are never displayed or stored by the browser. Changing them ends other active
            sessions.
          </p>
          <label className="preference-field">
            <span>Current admin password</span>
            <input
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
            />
          </label>
          <label className="preference-field">
            <span>New admin password</span>
            <input
              type="password"
              autoComplete="new-password"
              value={adminPassword}
              onChange={(event) => setAdminPassword(event.target.value)}
            />
          </label>
          <label className="preference-toggle">
            <input
              type="checkbox"
              checked={resolvedGuestEnabled}
              onChange={(event) => setGuestEnabled(event.target.checked)}
            />
            <span>Enable guest access</span>
          </label>
          <label className="preference-field">
            <span>New guest password</span>
            <input
              type="password"
              autoComplete="new-password"
              disabled={!resolvedGuestEnabled}
              value={guestPassword}
              onChange={(event) => setGuestPassword(event.target.value)}
            />
          </label>
          <div>
            <button
              disabled={!currentPassword || !hasChange || save.isPending}
              onClick={() => save.mutate()}
            >
              Update credentials
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

function DaemonSecretManager() {
  const [webPassword, setWebPassword] = useState("");
  const [webGuestPassword, setWebGuestPassword] = useState("");
  const [proxyPassword, setProxyPassword] = useState("");
  const client = useQueryClient();
  const saveWebCredentials = useMutation({
    mutationFn: () =>
      api.patchPreferences({
        remote_controls: {
          webserver: {
            ...(webPassword ? { password: webPassword } : {}),
            ...(webGuestPassword ? { guest_password: webGuestPassword } : {}),
          },
        },
      }),
    onSuccess: () => {
      setWebPassword("");
      setWebGuestPassword("");
      void client.invalidateQueries({ queryKey: queryKeys.preferences });
      toast.success("Legacy web credentials updated.");
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
  const saveProxyPassword = useMutation({
    mutationFn: () => api.patchPreferences({ connection: { proxy_password: proxyPassword } }),
    onSuccess: () => {
      setProxyPassword("");
      void client.invalidateQueries({ queryKey: queryKeys.preferences });
      toast.success("Proxy password updated.");
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
  return (
    <section className="panel preference-group password-manager">
      <div className="panel-title">
        <h2>
          <KeyRound size={17} /> Daemon credentials
        </h2>
        <span>Write-only</span>
      </div>
      <div className="preference-fields">
        <p className="preference-help">
          These values are sent only when saved, then cleared from this page. They can never be read
          back.
        </p>
        <div className="preference-secret-group">
          <h3>Legacy web server</h3>
          <label className="preference-field">
            <span>New admin password</span>
            <input
              type="password"
              autoComplete="new-password"
              value={webPassword}
              onChange={(event) => setWebPassword(event.target.value)}
            />
          </label>
          <label className="preference-field">
            <span>New guest password</span>
            <input
              type="password"
              autoComplete="new-password"
              value={webGuestPassword}
              onChange={(event) => setWebGuestPassword(event.target.value)}
            />
          </label>
          <button
            disabled={(!webPassword && !webGuestPassword) || saveWebCredentials.isPending}
            onClick={() => saveWebCredentials.mutate()}
          >
            Save web credentials
          </button>
        </div>
        <div className="preference-secret-group">
          <h3>Daemon proxy</h3>
          <label className="preference-field">
            <span>New proxy password</span>
            <input
              type="password"
              autoComplete="new-password"
              value={proxyPassword}
              onChange={(event) => setProxyPassword(event.target.value)}
            />
          </label>
          <button
            disabled={!proxyPassword || saveProxyPassword.isPending}
            onClick={() => saveProxyPassword.mutate()}
          >
            Save proxy password
          </button>
        </div>
      </div>
    </section>
  );
}

export function PreferencesView() {
  const client = useQueryClient();
  const preferences = useQuery({ queryKey: queryKeys.preferences, queryFn: api.preferences });
  const [draft, setDraft] = useState<Preferences>();
  const [advanced, setAdvanced] = useState(false);
  const workingDraft = draft ?? preferences.data;
  const patch = useMemo(
    () =>
      preferences.data && workingDraft
        ? (diff(preferences.data, workingDraft) as Preferences | undefined)
        : undefined,
    [preferences.data, workingDraft],
  );
  const needsRestart =
    preferences.data && workingDraft
      ? changedPaths(preferences.data, workingDraft).some((path) => restartKeys.has(path))
      : false;
  const validationErrors = useMemo(
    () => (workingDraft ? validatePreferences(workingDraft) : []),
    [workingDraft],
  );
  const save = useMutation({
    mutationFn: () => api.patchPreferences(patch ?? {}),
    onSuccess: (result) => {
      client.setQueryData(queryKeys.preferences, result);
      setDraft(clone(result));
      toast.success("Preferences saved.");
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
  const updateGroup = (group: string, key: string, value: unknown) =>
    setDraft((current) => ({
      ...(current ?? clone(preferences.data ?? {})),
      [group]: {
        ...((current ?? preferences.data)?.[group] as Record<string, unknown>),
        [key]: value,
      },
    }));
  return (
    <div className="content preferences-view">
      <h1>Preferences</h1>
      <p className="subtle">
        <ShieldAlert size={16} /> Changes are applied to the daemon only when you save.
      </p>
      {needsRestart && (
        <p className="preference-restart">
          <ShieldAlert size={16} /> Some changes take effect after restarting aMule.
        </p>
      )}
      {validationErrors.length > 0 && (
        <p className="preference-validation" role="alert">
          <ShieldAlert size={16} /> {validationErrors[0]}
        </p>
      )}
      <div className="preference-toolbar">
        <span>{patch ? "Unsaved changes" : "No unsaved changes"}</span>
        <label className="preference-advanced-toggle">
          <input
            type="checkbox"
            checked={advanced}
            onChange={(event) => setAdvanced(event.target.checked)}
          />
          Advanced view
        </label>
        <button
          className="muted"
          disabled={!patch}
          onClick={() => preferences.data && setDraft(clone(preferences.data))}
        >
          <RotateCcw size={15} /> Discard
        </button>
        <button
          disabled={!patch || save.isPending || validationErrors.length > 0}
          onClick={() => save.mutate()}
        >
          <Save size={15} /> Save changes
        </button>
      </div>
      <VersionChecker />
      {preferences.isPending || preferences.isError ? (
        <QueryNotice
          loading={preferences.isPending}
          error={preferences.error}
          onRetry={() => void preferences.refetch()}
        />
      ) : preferences.data && workingDraft ? (
        <div className="preference-grid">
          {Object.entries(preferences.data)
            .filter(([, value]) => isRecord(value))
            .map(([group, value]) => (
              <PreferenceGroup
                key={group}
                title={group}
                value={value as Record<string, unknown>}
                draft={workingDraft[group] as Record<string, unknown>}
                visibleFields={advanced ? undefined : (basicPreferenceFields[group] ?? [])}
                onChange={(key, next) => updateGroup(group, key, next)}
              />
            ))}
          {advanced && <PasswordManager />}
          {advanced && <DaemonSecretManager />}
        </div>
      ) : null}
    </div>
  );
}
