export const queryKeys = {
  status: ["status"] as const,
  downloads: ["downloads"] as const,
  uploadClients: ["clients", "uploads"] as const,
  servers: ["servers"] as const,
  categories: ["categories"] as const,
  searches: ["searches"] as const,
  searchResults: (searchId: number | undefined) => ["search-results", searchId] as const,
} as const;
