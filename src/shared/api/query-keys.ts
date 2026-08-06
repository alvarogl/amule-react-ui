export const queryKeys = {
  status: ["status"] as const,
  downloads: ["downloads"] as const,
  uploadClients: ["clients", "uploads"] as const,
  servers: ["servers"] as const,
  categories: ["categories"] as const,
  searches: ["searches"] as const,
  searchResults: (searchId: number | undefined) => ["search-results", searchId] as const,
  download: (hash: string) => ["download", hash] as const,
  downloadFilenames: (hash: string) => ["download-filenames", hash] as const,
  downloadComments: (hash: string) => ["download-comments", hash] as const,
  downloadA4af: (hash: string) => ["download-a4af", hash] as const,
} as const;
