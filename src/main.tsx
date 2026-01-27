import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Register PWA service worker but don't auto-reload on updates
// This prevents losing user input when new versions are deployed
import { registerSW } from "virtual:pwa-register";

registerSW({
  immediate: true,
  onNeedRefresh() {
    // Don't force reload - let the user finish their work
    // New version will activate on next manual page load
    console.log("New app version available. Refresh to update.");
  },
  onOfflineReady() {
    console.log("App ready for offline use.");
  },
});

createRoot(document.getElementById("root")!).render(<App />);
