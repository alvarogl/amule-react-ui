import { z } from "zod";
import { uiConfig } from "@/shared/config/ui-config";
import { notifyUnauthorized } from "@/shared/auth/unauthorized";

const errorSchema = z.object({
  error: z.object({ code: z.string(), message: z.string() }),
});
export const statusSchema = z.object({
  ec_connected: z.boolean(),
  ed2k: z.object({
    state: z.string(),
    high_id: z.boolean(),
    user_id: z.number(),
    public_ip: z.string().nullable(),
    connected_since_at: z.number(),
    server_name: z.string().nullable(),
    server_ip: z.string().nullable(),
    server_port: z.number().nullable(),
    network: z.object({ user_count: z.number().nullable(), file_count: z.number().nullable() }),
  }),
  kad: z.object({
    state: z.string(),
    firewalled_tcp: z.boolean().nullable(),
    connected_since_at: z.number(),
    network: z.object({
      user_count: z.number().nullable(),
      file_count: z.number().nullable(),
      node_count: z.number().nullable(),
    }),
  }),
  speeds: z.object({
    download_speed_bytes_per_second: z.number(),
    upload_speed_bytes_per_second: z.number(),
    download_overhead_bytes_per_second: z.number(),
    upload_overhead_bytes_per_second: z.number(),
  }),
  disk: z.object({
    temp_free_bytes: z.number().nullable(),
    incoming_free_bytes: z.number().nullable(),
  }),
  queue: z.object({
    waiting_upload_client_count: z.number(),
    download_source_count: z.number(),
  }),
});
export const versionSchema = z.object({
  service: z.literal("amuleapi"),
  api_version: z.string(),
  amuleapi_version: z.string(),
  daemon_version: z.string(),
  // /version is deliberately public; update information is only included for an
  // authenticated request.
  update: z
    .object({
      check_enabled: z.boolean(),
      checked: z.boolean(),
      latest_version: z.string().nullable(),
      available: z.boolean().nullable(),
      last_checked_at: z.number().nullable(),
    })
    .optional(),
});
export const downloadSchema = z
  .object({
    hash: z.string(),
    name: z.string(),
    size_bytes: z.number(),
    completed_bytes: z.number(),
    transferred_bytes: z.number(),
    progress: z
      .object({
        percent: z.number(),
        parts: z.array(z.object({ state: z.string(), sources: z.number() })).optional(),
      })
      .optional(),
    status: z.string(),
    speed_bytes_per_second: z.number(),
    category_index: z.number(),
    priority: z.enum(["low", "normal", "high"]).optional(),
    priority_auto: z.boolean().optional(),
    sources: z
      .object({
        total: z.number(),
        unavailable: z.number(),
        transferring: z.number(),
        a4af: z.number(),
      })
      .optional(),
    available_part_count: z.number().optional(),
    total_part_count: z.number().optional(),
    remaining_seconds: z.number().nullable().optional(),
  })
  .passthrough();
export const downloadsSchema = z.object({ downloads: z.array(downloadSchema) }).passthrough();
const searchSchema = z.object({
  search_id: z.number(),
  query: z.string(),
  type: z.enum(["local", "global", "kad", "browse"]),
  state: z.string(),
});
export const searchesSchema = z.object({ searches: z.array(searchSchema) });
export const searchResultsSchema = z.object({
  search_id: z.number(),
  results: z.array(
    z
      .object({
        hash: z.string(),
        name: z.string(),
        size_bytes: z.number(),
        already_downloaded: z.boolean(),
        sources: z.object({ total: z.number(), complete: z.number() }),
        alternate_names: z.array(
          z.object({
            ecid: z.number(),
            name: z.string(),
            sources: z.object({ total: z.number(), complete: z.number() }),
            directory: z.string(),
          }),
        ),
        rating: z.number().optional(),
        kad_comment_lookup_running: z.boolean(),
        comments: z
          .array(
            z.object({
              username: z.string(),
              filename: z.string(),
              rating: z.number(),
              comment: z.string(),
            }),
          )
          .optional(),
      })
      .passthrough(),
  ),
  progress: z.object({
    state: z.string(),
    type: z.string(),
    percent: z.number(),
  }),
});
export const serversSchema = z.object({
  servers: z.array(
    z
      .object({
        ecid: z.number(),
        name: z.string(),
        address: z.string(),
        user_count: z.number(),
        file_count: z.number(),
        priority: z.string(),
        permanent: z.boolean(),
      })
      .passthrough(),
  ),
});
export const categoriesSchema = z.object({
  categories: z.array(
    z
      .object({
        index: z.number(),
        name: z.string(),
        save_path: z.string(),
        comment: z.string().optional(),
      })
      .passthrough(),
  ),
});
export const sharedFileSchema = z
  .object({
    hash: z.string(),
    name: z.string(),
    ed2k_link: z.string(),
    size_bytes: z.number(),
    priority: z.enum(["very_low", "low", "normal", "high", "release"]),
    priority_auto: z.boolean(),
    sources: z.object({ complete: z.number() }),
    uploaded_bytes_session: z.number(),
    uploaded_bytes_total: z.number(),
    request_count_session: z.number(),
    request_count_total: z.number(),
    accepted_request_count_session: z.number(),
    accepted_request_count_total: z.number(),
    upload_speed_bytes_per_second: z.number(),
    uploading_client_count: z.number(),
    last_upload_at: z.number().nullable(),
    shared_since_at: z.number().nullable(),
    file_type: z.string().optional(),
    share_ratio: z.number().optional(),
    directory: z.string().optional(),
    incomplete: z.boolean().optional(),
    total_part_count: z.number().optional(),
    upload_ratio: z.number().optional(),
    upload_queue_count: z.number().optional(),
    my_comment: z.string().optional(),
    my_rating: z.number().optional(),
    aich_hash: z.string().nullable().optional(),
  })
  .passthrough();
export const sharedFilesSchema = z.object({ shared: z.array(sharedFileSchema) }).passthrough();
export const sharedDirectoriesSchema = z.object({
  directories: z.array(z.object({ path: z.string(), recursive: z.boolean() })),
});
export const kadSchema = z.object({
  state: z.string(),
  firewalled_tcp: z.boolean().nullable(),
  firewalled_udp: z.boolean().nullable(),
  lan_mode: z.boolean().nullable(),
  public_ip: z.string().nullable(),
  network: z.object({ user_count: z.number().nullable(), file_count: z.number().nullable(), node_count: z.number().nullable() }),
  indexed: z.object({
    sources: z.number().nullable(),
    keywords: z.number().nullable(),
    notes: z.number().nullable(),
    load_percent: z.number().nullable(),
  }),
  buddy: z.object({ state: z.string().nullable(), ip: z.string().nullable(), port: z.number().nullable() }),
});
export const amuleLogSchema = z.object({
  lines: z.array(z.string()),
  total_lines: z.number(),
  returned_lines: z.number(),
});
export const serverInfoLogSchema = z.object({
  text: z.string(),
  total_bytes: z.number(),
  returned_bytes: z.number(),
});
export type StatisticValue = {
  type: "integer" | "istring" | "ishort" | "bytes" | "speed" | "time" | "double" | "string";
  value: number | string;
  enum?: "never" | "not_available";
  extra?: StatisticValue | null;
};
const statisticValueSchema: z.ZodType<StatisticValue> = z.lazy(() =>
  z
    .object({
      type: z.enum(["integer", "istring", "ishort", "bytes", "speed", "time", "double", "string"]),
      value: z.union([z.number(), z.string()]),
      enum: z.enum(["never", "not_available"]).optional(),
      extra: statisticValueSchema.nullable().optional(),
    })
    .passthrough(),
);
export type StatisticNode = {
  key?: string;
  raw?: string;
  label: string;
  values: StatisticValue[];
  children: StatisticNode[];
  ratio?: { session?: number; total?: number };
};
const statisticNodeSchema: z.ZodType<StatisticNode> = z.lazy(() =>
  z
    .object({
      key: z.string().optional(),
      raw: z.string().optional(),
      label: z.string(),
      values: z.array(statisticValueSchema),
      children: z.array(statisticNodeSchema),
      ratio: z.object({ session: z.number().optional(), total: z.number().optional() }).optional(),
    })
    .passthrough(),
);
export const statisticsTreeSchema = z.object({ nodes: z.array(statisticNodeSchema) });
export const statisticsGraphSchema = z.object({
  graph: z.enum(["download_speed", "upload_speed", "connections", "kad_nodes"]),
  unit: z.enum(["bytes_per_second", "count"]),
  interval_seconds: z.number(),
  points: z.array(z.object({ at: z.number(), value: z.number() })),
  session: z.object({
    downloaded_bytes: z.number(),
    uploaded_bytes: z.number(),
    kad_node_seconds: z.number(),
    duration_seconds: z.number(),
  }),
});
export const preferencesSchema = z.record(z.string(), z.unknown());
export const passwordStatusSchema = z.object({
  admin_password_set: z.boolean(),
  guest_access_enabled: z.boolean(),
});
const bulkResultsSchema = z.object({
  results: z.array(
    z.object({
      id: z.string(),
      ok: z.boolean(),
      error: z.object({ code: z.string(), message: z.string() }).optional(),
    }),
  ),
});
export const clientSchema = z
  .object({
    ecid: z.number(),
    name: z.string().nullable(),
    ip: z.string().nullable(),
    software: z.string().nullable(),
    software_version: z.string().nullable(),
    upload_state: z.string(),
    download_state: z.string().optional(),
    upload_file_name: z.string().nullable(),
    download_file_name: z.string().nullable(),
    upload_speed_bytes_per_second: z.number(),
    download_speed_bytes_per_second: z.number(),
    country_code: z.string().nullable().optional(),
    port: z.number().nullable().optional(),
    reported_os: z.string().nullable().optional(),
    ident_state: z.string().optional(),
    obfuscation_state: z.string().nullable().optional(),
    upload_queue_position: z.number().optional(),
    remote_queue_position: z.number().nullable().optional(),
    upload_queue_score: z.number().optional(),
    high_id: z.boolean().optional(),
    server_name: z.string().nullable().optional(),
    server_ip: z.string().nullable().optional(),
    server_port: z.number().nullable().optional(),
    kad_port: z.number().nullable().optional(),
    source_origin: z.string().nullable().optional(),
    available_parts: z.number().optional(),
    client_mod_name: z.string().nullable().optional(),
    shared_files_browsable: z.boolean().optional(),
    friend: z.boolean().optional(),
    friend_slot: z.boolean().optional(),
    credit_ratio: z.number().nullable().optional(),
    part_progress_percent: z.number().nullable().optional(),
    uploaded_bytes_session: z.number().optional(),
    downloaded_bytes_session: z.number().optional(),
    uploaded_bytes_total: z.number().optional(),
    downloaded_bytes_total: z.number().optional(),
  })
  .passthrough();
export const clientsSchema = z.object({ clients: z.array(clientSchema) });
export const loginSchema = z.object({
  role: z.enum(["admin", "guest"]),
  expires_at: z.number(),
  session_id: z.string(),
});
export const sessionSchema = z.object({
  role: z.enum(["admin", "guest"]),
  expires_at: z.number(),
  session_id: z.string(),
});
export type Status = z.infer<typeof statusSchema>;
export type Download = z.infer<typeof downloadSchema>;
export type SearchResult = z.infer<typeof searchResultsSchema>["results"][number];
export type SharedFile = z.infer<typeof sharedFileSchema>;
export type Client = z.infer<typeof clientSchema>;
export type SearchFilters = {
  file_type?: string;
  extension?: string;
  min_size_bytes?: number;
  max_size_bytes?: number;
  min_source_count?: number;
};

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}
async function request<T>(path: string, schema: z.ZodType<T>, init?: RequestInit): Promise<T> {
  const url = uiConfig.apiBase.startsWith("http")
    ? `${uiConfig.apiBase}${path}`
    : new URL(`${uiConfig.apiBase}${path}`, window.location.origin).toString();
  const response = await fetch(url, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...init?.headers },
    ...init,
  });
  const json: unknown = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401) notifyUnauthorized();
    const parsed = errorSchema.safeParse(json);
    throw new ApiError(
      response.status,
      parsed.success ? parsed.data.error.message : `Request failed (${response.status})`,
    );
  }
  return schema.parse(json);
}
async function requestEmpty(path: string, init?: RequestInit): Promise<void> {
  const url = uiConfig.apiBase.startsWith("http")
    ? `${uiConfig.apiBase}${path}`
    : new URL(`${uiConfig.apiBase}${path}`, window.location.origin).toString();
  const response = await fetch(url, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...init?.headers },
    ...init,
  });
  if (response.ok) return;
  const json: unknown = await response.json().catch(() => ({}));
  if (response.status === 401) notifyUnauthorized();
  const parsed = errorSchema.safeParse(json);
  throw new ApiError(
    response.status,
    parsed.success ? parsed.data.error.message : `Request failed (${response.status})`,
  );
}
export const api = {
  login: (password: string) =>
    request("/auth/login", loginSchema, {
      method: "POST",
      body: JSON.stringify({ password }),
    }),
  logout: () => requestEmpty("/auth/logout", { method: "POST" }),
  session: () => request("/auth/session", sessionSchema),
  status: () => request("/status", statusSchema),
  version: () => request("/version", versionSchema),
  checkVersion: () => requestEmpty("/version/check", { method: "POST" }),
  downloads: () => request("/downloads?status=all", downloadsSchema),
  searches: () => request("/search", searchesSchema),
  startSearch: (query: string, type: "local" | "global" | "kad", filters: SearchFilters = {}) =>
    request(
      "/search",
      z.object({
        search_id: z.number(),
        query: z.string(),
        type: z.enum(["local", "global", "kad"]),
        state: z.string(),
        client_ecid: z.number().nullable(),
      }),
      { method: "POST", body: JSON.stringify({ query, type, ...filters }) },
    ),
  searchResults: (searchId: number) => request(`/search/${searchId}/results`, searchResultsSchema),
  closeSearch: (searchId: number) => requestEmpty(`/search/${searchId}`, { method: "DELETE" }),
  downloadSearchResult: (hash: string, options: { ecid?: number; category_index?: number } = {}) =>
    requestEmpty(`/search/results/${hash}/download`, {
      method: "POST",
      body: JSON.stringify(options),
    }),
  requestSearchResultComments: (hash: string) =>
    requestEmpty(`/search/results/${hash}/comments`, { method: "POST" }),
  servers: () => request("/servers", serversSchema),
  clients: (filter: "uploading" | "downloading" | "active" | "all" = "all") =>
    request(filter === "all" ? "/clients" : `/clients?activity=${filter}`, clientsSchema),
  client: (ecid: number) => request(`/clients/${ecid}`, clientSchema),
  browseClientSharedFiles: (ecid: number) =>
    request(`/clients/${ecid}/shared_files`, searchSchema, {
      method: "POST",
    }),
  uploadClients: () => request("/clients?activity=uploading", clientsSchema),
  addServer: (address: string, name: string) =>
    requestEmpty("/servers", {
      method: "POST",
      body: JSON.stringify({ address, name: name || undefined }),
    }),
  connectServer: (ecid: number) => requestEmpty(`/servers/${ecid}/connect`, { method: "POST" }),
  removeServer: (ecid: number) => requestEmpty(`/servers/${ecid}`, { method: "DELETE" }),
  patchServer: (
    ecid: number,
    patch: { priority?: "low" | "normal" | "high"; permanent?: boolean },
  ) =>
    request(`/servers/${ecid}`, serversSchema.shape.servers.element, {
      method: "PATCH",
      body: JSON.stringify(patch),
    }),
  updateServers: (servers_url: string) =>
    requestEmpty("/servers_update", {
      method: "POST",
      body: JSON.stringify({ url: servers_url }),
    }),
  network: (action: "connect" | "disconnect", network: "ed2k" | "kad" | "both") =>
    requestEmpty(`/networks/${action}`, {
      method: "POST",
      body: JSON.stringify({ network }),
    }),
  categories: () => request("/categories", categoriesSchema),
  sharedFiles: () => request("/shared", sharedFilesSchema),
  sharedFile: (hash: string) => request(`/shared/${hash}`, sharedFileSchema),
  sharedDirectories: () => request("/share_directories", sharedDirectoriesSchema),
  addSharedDirectory: (path: string, recursive: boolean) =>
    request("/share_directories", bulkResultsSchema, {
      method: "POST",
      body: JSON.stringify({ path, recursive }),
    }),
  replaceSharedDirectories: (directories: Array<{ path: string; recursive: boolean }>) =>
    request("/share_directories", bulkResultsSchema, {
      method: "PUT",
      body: JSON.stringify({ directories }),
    }),
  removeSharedDirectory: (path: string) =>
    request(`/share_directories?path=${encodeURIComponent(path)}`, bulkResultsSchema, {
      method: "DELETE",
    }),
  kad: () => request("/kad", kadSchema),
  bootstrapKad: (ip: string, port: number) =>
    requestEmpty("/kad/bootstrap", {
      method: "POST",
      body: JSON.stringify({ ip, port }),
    }),
  updateKadNodes: (nodes_url: string) =>
    requestEmpty("/kad/update", {
      method: "POST",
      body: JSON.stringify({ url: nodes_url }),
    }),
  amuleLog: (tail = 500) => request(`/logs/amule?tail=${tail}`, amuleLogSchema),
  clearAmuleLog: () => requestEmpty("/logs/amule", { method: "DELETE" }),
  serverInfoLog: (tail = 500) => request(`/logs/server_info?tail=${tail}`, serverInfoLogSchema),
  clearServerInfoLog: () => requestEmpty("/logs/server_info", { method: "DELETE" }),
  statisticsTree: () => request("/stats/tree", statisticsTreeSchema),
  statisticsGraph: (graph: "download" | "upload" | "connections" | "kad", width = 300) => {
    const apiGraph = {
      download: "download_speed",
      upload: "upload_speed",
      connections: "connections",
      kad: "kad_nodes",
    }[graph];
    return request(`/stats/graphs/${apiGraph}?width=${width}`, statisticsGraphSchema);
  },
  preferences: () => request("/preferences", preferencesSchema),
  patchPreferences: (patch: Record<string, unknown>) =>
    request("/preferences", preferencesSchema, {
      method: "PATCH",
      body: JSON.stringify(patch),
    }),
  passwordStatus: () => request("/auth/passwords", passwordStatusSchema),
  patchPasswords: (patch: {
    current_password: string;
    admin_password?: string;
    guest_password?: string;
    guest_access_enabled?: boolean;
  }) =>
    request("/auth/passwords", passwordStatusSchema.passthrough(), {
      method: "PATCH",
      body: JSON.stringify(patch),
    }),
  reloadSharedFiles: () => requestEmpty("/shared_reload", { method: "POST" }),
  patchSharedFile: (
    hash: string,
    patch: {
      priority?: "very_low" | "low" | "normal" | "high" | "release" | "auto";
      name?: string;
      my_comment?: string;
      my_rating?: number;
    },
  ) =>
    request(`/shared/${hash}`, sharedFileSchema, {
      method: "PATCH",
      body: JSON.stringify(patch),
    }),
  verifySharedFile: (hash: string) => requestEmpty(`/shared/${hash}/verify`, { method: "POST" }),
  addCategory: (name: string, save_path?: string) =>
    requestEmpty("/categories", {
      method: "POST",
      body: JSON.stringify({ name, ...(save_path ? { save_path } : {}) }),
    }),
  patchCategory: (index: number, patch: { name?: string; save_path?: string }) =>
    request(`/categories/${index}`, categoriesSchema.shape.categories.element, {
      method: "PATCH",
      body: JSON.stringify(patch),
    }),
  removeCategory: (index: number) => requestEmpty(`/categories/${index}`, { method: "DELETE" }),
  setDownloadCategory: (hash: string, category: number) =>
    request(`/downloads/${hash}`, z.unknown(), {
      method: "PATCH",
      body: JSON.stringify({ category_index: category }),
    }),
  bulkDownloads: (
    hashes: string[],
    patch: {
      action?: "pause" | "resume" | "stop";
      priority?: "low" | "normal" | "high" | "auto";
    },
  ) =>
    request("/downloads", bulkResultsSchema, {
      method: "PATCH",
      body: JSON.stringify({ hashes, ...patch }),
    }),
  clearCompleted: (hash?: string) =>
    request("/downloads_clear_completed", bulkResultsSchema, {
      method: "POST",
      ...(hash ? { body: JSON.stringify({ hash }) } : {}),
    }),
  downloadDetail: (hash: string) => request(`/downloads/${hash}`, downloadSchema),
  downloadFilenames: (hash: string) =>
    request(
      `/downloads/${hash}/filenames`,
      z.object({
        filenames: z.array(z.object({ filename: z.string(), source_count: z.number() })),
      }),
    ),
  downloadComments: (hash: string) =>
    request(
      `/downloads/${hash}/comments`,
      z
        .object({
          comments: z.array(
            z.object({
              username: z.string(),
              filename: z.string(),
              rating: z.number(),
              comment: z.string(),
            }),
          ),
        })
        .passthrough(),
    ),
  downloadA4af: (hash: string) =>
    request(
      `/downloads/${hash}/a4af`,
      z.object({ a4af_auto: z.boolean(), source_ecids: z.array(z.number()) }),
    ),
  a4afAction: (hash: string, action: "swap_this" | "swap_this_auto" | "swap_others") =>
    request(
      `/downloads/${hash}/a4af`,
      z.object({ a4af_auto: z.boolean(), source_ecids: z.array(z.number()) }),
      {
        method: "POST",
        body: JSON.stringify({ action }),
      },
    ),
  addLinks: (links: string[]) =>
    request(
      "/downloads",
      z.object({
        results: z.array(z.object({ id: z.string(), ok: z.boolean() })).optional(),
      }),
      { method: "POST", body: JSON.stringify({ links }) },
    ),
  downloadAction: (hash: string, action: "pause" | "resume") =>
    request(`/downloads/${hash}`, downloadSchema, {
      method: "PATCH",
      body: JSON.stringify({ action }),
    }),
  renameDownload: (hash: string, name: string) =>
    request(`/downloads/${hash}`, downloadSchema, {
      method: "PATCH",
      body: JSON.stringify({ name }),
    }),
  removeDownload: (hash: string) => requestEmpty(`/downloads/${hash}`, { method: "DELETE" }),
  removeDownloads: (hashes: string[]) =>
    request("/downloads", bulkResultsSchema, {
      method: "DELETE",
      body: JSON.stringify({ hashes }),
    }),
};
