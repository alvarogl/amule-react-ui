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
    low_id: z.boolean(),
    server_name: z.string().optional(),
  }),
  kad: z.object({ state: z.string(), firewalled: z.boolean() }),
  speeds: z.object({ download_bps: z.number(), upload_bps: z.number() }),
  queue: z.object({
    upload_queue_length: z.number(),
    total_source_count: z.number(),
  }),
});
export const downloadSchema = z
  .object({
    hash: z.string(),
    name: z.string(),
    size: z.number().optional(),
    size_done: z.number().optional(),
    size_xfer: z.number().optional(),
    progress: z.object({ percent: z.number() }).optional(),
    status: z.string(),
    speed_bps: z.number().optional(),
    category: z.number().optional(),
    priority: z.enum(["low", "normal", "high"]).optional(),
    priority_auto: z.boolean().optional(),
  })
  .passthrough();
export const downloadsSchema = z.object({ downloads: z.array(downloadSchema) }).passthrough();
const searchSchema = z.object({
  search_id: z.number(),
  query: z.string(),
  kind: z.enum(["local", "global", "kad"]),
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
        size: z.number(),
        already_have: z.boolean(),
        sources: z.object({ total: z.number(), complete: z.number() }),
        children: z.array(z.object({ ecid: z.number(), name: z.string() })),
        rating: z.number().optional(),
        kad_comment_search_running: z.boolean().optional(),
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
    kind: z.string(),
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
        users: z.number(),
        files: z.number(),
        priority: z.string(),
        static: z.boolean(),
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
        path: z.string(),
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
    size: z.number(),
    priority: z.enum(["very_low", "low", "normal", "high", "release"]),
    priority_auto: z.boolean(),
    complete_sources: z.number(),
    xfer: z.object({ session: z.number(), total: z.number() }),
    requests: z.object({ session: z.number(), total: z.number() }),
    accepts: z.object({ session: z.number(), total: z.number() }),
    upload_speed_bps: z.number(),
    uploading: z.number(),
    last_upload: z.number(),
    shared_since: z.number(),
    file_type: z.string().optional(),
    share_ratio: z.number().optional(),
    path: z.string().optional(),
    complete_sources_range: z.object({ low: z.number(), high: z.number() }).optional(),
    aich_hash: z.string().optional(),
    part_count: z.number().optional(),
    queued_count: z.number().optional(),
    comment: z.string().optional(),
    rating: z.number().optional(),
  })
  .passthrough();
export const sharedFilesSchema = z.object({ shared: z.array(sharedFileSchema) }).passthrough();
export const sharedDirectoriesSchema = z.object({
  directories: z.array(z.object({ path: z.string(), recursive: z.boolean() })),
});
export const kadSchema = z.object({
  state: z.string(),
  firewalled: z.boolean(),
  firewalled_udp: z.boolean(),
  in_lan_mode: z.boolean(),
  ip: z.string(),
  network: z.object({ users: z.number(), files: z.number(), nodes: z.number() }),
  indexed: z.object({
    sources: z.number(),
    keywords: z.number(),
    notes: z.number(),
    load: z.number(),
  }),
  buddy: z.object({ status: z.string(), ip: z.string(), port: z.number() }).optional(),
});
const sharedDirectoryMutationSchema = z
  .object({
    ok: z.literal(true),
    rejected: z.array(z.object({ path: z.string(), reason: z.string() })).default([]),
  })
  .passthrough();
export const clientsSchema = z.object({
  clients: z.array(
    z
      .object({
        client_ecid: z.number(),
        client_name: z.string(),
        ip: z.string(),
        software: z.string(),
        software_version: z.string(),
        upload_state: z.string(),
        upload_file_name: z.string(),
        upload_speed_bps: z.number(),
      })
      .passthrough(),
  ),
});
export const loginSchema = z.object({
  role: z.literal("admin"),
  expires_at: z.string(),
});
export const sessionSchema = z.object({
  role: z.literal("admin"),
  exp: z.string(),
  exp_unix: z.number(),
  jti: z.string(),
});
export type Status = z.infer<typeof statusSchema>;
export type Download = z.infer<typeof downloadSchema>;
export type SearchResult = z.infer<typeof searchResultsSchema>["results"][number];
export type SharedFile = z.infer<typeof sharedFileSchema>;
export type SearchFilters = {
  file_type?: string;
  extension?: string;
  min_size?: number;
  max_size?: number;
  min_avail?: number;
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
  const response = await fetch(`${uiConfig.apiBase}${path}`, {
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
export const api = {
  login: (password: string) =>
    request("/auth/login", loginSchema, {
      method: "POST",
      body: JSON.stringify({ password }),
    }),
  logout: () => request("/auth/logout", z.unknown(), { method: "POST" }),
  session: () => request("/auth/session", sessionSchema),
  status: () => request("/status", statusSchema),
  downloads: () => request("/downloads?include_completed=true", downloadsSchema),
  searches: () => request("/search", searchesSchema),
  startSearch: (query: string, type: "local" | "global" | "kad", filters: SearchFilters = {}) =>
    request(
      "/search",
      z.object({
        ok: z.literal(true),
        search_id: z.number(),
        query: z.string(),
      }),
      { method: "POST", body: JSON.stringify({ query, type, ...filters }) },
    ),
  searchResults: (searchId: number) =>
    request(`/search/results?search_id=${searchId}`, searchResultsSchema),
  stopSearch: (searchId: number) =>
    request("/search/stop", z.object({ ok: z.literal(true) }), {
      method: "POST",
      body: JSON.stringify({ search_id: searchId, close: true }),
    }),
  downloadSearchResult: (hash: string, options: { ecid?: number; category?: number } = {}) =>
    request(`/search/results/${hash}/download`, z.object({ ok: z.literal(true) }).passthrough(), {
      method: "POST",
      body: JSON.stringify(options),
    }),
  requestSearchResultComments: (hash: string) =>
    request(`/search/results/${hash}/comments`, z.object({ status: z.string() }).passthrough(), {
      method: "POST",
    }),
  servers: () => request("/servers", serversSchema),
  uploadClients: () => request("/clients?filter=uploads", clientsSchema),
  addServer: (address: string, name: string) =>
    request("/servers", z.object({ ok: z.literal(true) }).passthrough(), {
      method: "POST",
      body: JSON.stringify({ address, name: name || undefined }),
    }),
  connectServer: (ecid: number) =>
    request(`/servers/${ecid}/connect`, z.object({ ok: z.literal(true) }).passthrough(), {
      method: "POST",
    }),
  removeServer: (ecid: number) =>
    request(`/servers/${ecid}`, z.object({ ok: z.literal(true) }).passthrough(), {
      method: "DELETE",
    }),
  patchServer: (ecid: number, patch: { priority?: "low" | "normal" | "high"; static?: boolean }) =>
    request(`/servers/${ecid}`, z.object({ ok: z.literal(true) }).passthrough(), {
      method: "PATCH",
      body: JSON.stringify(patch),
    }),
  updateServers: (servers_url: string) =>
    request("/servers/update", z.object({ ok: z.literal(true) }).passthrough(), {
      method: "POST",
      body: JSON.stringify({ servers_url }),
    }),
  network: (action: "connect" | "disconnect", network: "ed2k" | "kad" | "both") =>
    request(`/networks/${action}`, z.unknown(), {
      method: "POST",
      body: JSON.stringify({ network }),
    }),
  categories: () => request("/categories", categoriesSchema),
  sharedFiles: () => request("/shared", sharedFilesSchema),
  sharedFile: (hash: string) => request(`/shared/${hash}`, sharedFileSchema),
  sharedDirectories: () => request("/shared/directories", sharedDirectoriesSchema),
  addSharedDirectory: (path: string, recursive: boolean) =>
    request("/shared/directories", sharedDirectoryMutationSchema, {
      method: "POST",
      body: JSON.stringify({ path, recursive }),
    }),
  removeSharedDirectory: (path: string) =>
    request(`/shared/directories?path=${encodeURIComponent(path)}`, sharedDirectoryMutationSchema, {
      method: "DELETE",
    }),
  kad: () => request("/kad", kadSchema),
  bootstrapKad: (ip: string | number, port: number) =>
    request("/kad/bootstrap", z.object({ ok: z.literal(true), ip: z.number(), port: z.number() }), {
      method: "POST",
      body: JSON.stringify({ ip, port }),
    }),
  updateKadNodes: (nodes_url: string) =>
    request("/kad/update", z.object({ ok: z.literal(true), nodes_url: z.string() }), {
      method: "POST",
      body: JSON.stringify({ nodes_url }),
    }),
  reloadSharedFiles: () =>
    request("/shared/reload", z.object({ ok: z.literal(true) }).passthrough(), { method: "POST" }),
  patchSharedFile: (
    hash: string,
    patch: {
      priority?: "very_low" | "low" | "normal" | "high" | "release" | "auto";
      name?: string;
      comment?: string;
      rating?: number;
    },
  ) =>
    request(`/shared/${hash}`, sharedFileSchema, {
      method: "PATCH",
      body: JSON.stringify(patch),
    }),
  verifySharedFile: (hash: string) =>
    request(`/shared/${hash}/verify`, z.object({ ok: z.literal(true) }).passthrough(), {
      method: "POST",
    }),
  addCategory: (name: string, path?: string) =>
    request("/categories", z.object({ index: z.number(), name: z.string() }).passthrough(), {
      method: "POST",
      body: JSON.stringify({ name, ...(path ? { path } : {}) }),
    }),
  patchCategory: (index: number, patch: { name?: string; path?: string }) =>
    request(`/categories/${index}`, z.object({ ok: z.literal(true) }).passthrough(), {
      method: "PATCH",
      body: JSON.stringify(patch),
    }),
  removeCategory: (index: number) =>
    request(`/categories/${index}`, z.object({ ok: z.literal(true) }).passthrough(), {
      method: "DELETE",
    }),
  setDownloadCategory: (hash: string, category: number) =>
    request(`/downloads/${hash}`, z.unknown(), {
      method: "PATCH",
      body: JSON.stringify({ category }),
    }),
  bulkDownloads: (
    hashes: string[],
    patch: {
      status?: "paused" | "resumed";
      priority?: "low" | "normal" | "high" | "auto";
    },
  ) =>
    request("/downloads", z.object({ results: z.array(z.unknown()).optional() }).passthrough(), {
      method: "PATCH",
      body: JSON.stringify({ hashes, ...patch }),
    }),
  clearCompleted: (hash?: string) =>
    request(
      "/downloads/clear_completed",
      z.object({ ok: z.literal(true), cleared: z.number() }).passthrough(),
      { method: "POST", ...(hash ? { body: JSON.stringify({ hash }) } : {}) },
    ),
  downloadDetail: (hash: string) => request(`/downloads/${hash}`, downloadSchema),
  downloadFilenames: (hash: string) =>
    request(
      `/downloads/${hash}/filenames`,
      z.object({
        filenames: z.array(z.object({ name: z.string(), count: z.number() })),
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
      z.object({ a4af: z.array(z.unknown()).optional() }).passthrough(),
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
    request(`/downloads/${hash}`, z.unknown(), {
      method: "PATCH",
      body: JSON.stringify({
        status: action === "pause" ? "paused" : "resumed",
      }),
    }),
  removeDownload: (hash: string) =>
    request(`/downloads/${hash}`, z.object({ ok: z.literal(true) }).passthrough(), {
      method: "DELETE",
    }),
  removeDownloads: (hashes: string[]) =>
    request(
      "/downloads",
      z
        .object({
          results: z.array(z.object({ id: z.string(), ok: z.boolean() }).passthrough()).optional(),
        })
        .passthrough(),
      { method: "DELETE", body: JSON.stringify({ hashes }) },
    ),
};
