import { QueryClient } from "@tanstack/react-query";
import { ApiError } from "@/shared/api/amule-api";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => !(error instanceof ApiError) && failureCount < 2,
      refetchOnWindowFocus: false,
    },
  },
});
