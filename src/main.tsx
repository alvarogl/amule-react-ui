import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { App } from "./ui/App";
import { SessionProvider } from "./session";
import { Toaster } from "sonner";
import "./styles.css";
import "./transfers.css";
import "./search.css";
import "./servers.css";
import "./categories.css";
import "./details.css";
import "./navigation.css";
import "./data-table.css";
import "./layout.css";
import "./confirm-dialog.css";
import "./status.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (count, error) => !(error instanceof Error && error.name === "ApiError") && count < 2,
      refetchOnWindowFocus: false,
    },
  },
});
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <SessionProvider>
        <App />
        <Toaster position="bottom-left" richColors closeButton />
      </SessionProvider>
    </QueryClientProvider>
  </StrictMode>,
);
