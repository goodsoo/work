import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import "./index.css";
import App from "./App";
import { queryClient } from "./lib/queryClient";
import { VaultProvider } from "./lib/vault/VaultProvider";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <VaultProvider>
        <App />
      </VaultProvider>
    </QueryClientProvider>
  </StrictMode>
);
