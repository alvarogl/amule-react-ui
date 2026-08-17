import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { App } from "@/app/App";
import { queryClient } from "@/app/query-client";
import { SessionProvider } from "@/features/auth/session-context";
import "@/app/styles.css";
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
