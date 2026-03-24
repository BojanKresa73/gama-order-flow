import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Register PWA service worker but don't auto-reload on updates
// This prevents losing user input when new versions are deployed
import { registerSW } from "virtual:pwa-register";
import { toast } from "sonner";

let updateToastShown = false;

const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() {
    if (!updateToastShown) {
      updateToastShown = true;
      toast("Dostupna je nova verzija aplikacije.", {
        id: "app-update",
        duration: Infinity,
        action: {
          label: "Osveži",
          onClick: () => {
            updateSW(true).then(() => {
              window.location.reload();
            }).catch(() => {
              window.location.reload();
            });
          },
        },
      });
    }
    console.log("New app version available. Refresh to update.");
  },
  onOfflineReady() {
    console.log("App ready for offline use.");
  },
  onRegisteredSW(swUrl, registration) {
    // Check for updates every 30 minutes
    if (registration) {
      setInterval(() => {
        registration.update();
      }, 30 * 60 * 1000);
    }
  },
});
// Register push notification service worker (separate from PWA SW)
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("/push-sw.js").catch((err) => {
    console.log("Push SW registration failed:", err);
  });
}

createRoot(document.getElementById("root")!).render(<App />);
