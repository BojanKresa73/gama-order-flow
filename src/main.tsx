import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Ensure users don't get stuck on an old cached version (PWA/service worker).
// This will auto-apply updates as soon as they're available.
import { registerSW } from "virtual:pwa-register";

const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() {
    // Force activate + reload to the new version
    updateSW(true);
  },
});

createRoot(document.getElementById("root")!).render(<App />);
