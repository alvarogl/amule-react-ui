import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { App } from "@/app/App";
import { queryClient } from "@/app/query-client";
import { SessionProvider } from "@/features/auth/session-context";
import "@/app/styles.css";
import "@/app/layout.css";
import "@/app/navigation.css";
import "@/app/status.css";
import "@/features/transfers/transfers.css";
import "@/features/transfers/details.css";
import "@/features/search/search.css";
import "@/features/servers/servers.css";
import "@/features/categories/categories.css";
import "@/features/shared/shared.css";
import "@/shared/styles/data-table.css";
import "@/shared/styles/confirm-dialog.css";
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
