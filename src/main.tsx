import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Register PWA service worker but don't auto-reload on updates
// This prevents losing user input when new versions are deployed
import { registerSW } from "virtual:pwa-register";
import { toast } from "sonner";

let updateToastShown = false;

const isInIframe = (() => {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
})();

const isPreviewHost =
  window.location.hostname.includes("id-preview--") ||
  window.location.hostname.includes("lovableproject.com");

const shouldDisableServiceWorkers = isInIframe || isPreviewHost;

async function setupServiceWorkers() {
  if (!("serviceWorker" in navigator)) return;

  if (shouldDisableServiceWorkers) {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map((registration) => registration.unregister()));
    return;
  }

  const registrations = await navigator.serviceWorker.getRegistrations();

  await Promise.all(
    registrations
      .filter((registration) => {
        const workerUrls = [registration.active, registration.waiting, registration.installing]
          .filter(Boolean)
          .map((worker) => worker.scriptURL);

        return (
          workerUrls.some((url) => url.endsWith("/push-sw.js")) &&
          new URL(registration.scope).pathname === "/"
        );
      })
      .map((registration) => registration.unregister())
  );

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
      if (registration) {
        setInterval(() => {
          registration.update();
        }, 30 * 60 * 1000);
      }
    },
  });

  const portalPushRegistration = await navigator.serviceWorker.getRegistration("/portal/");

  if (!portalPushRegistration) {
    try {
      await navigator.serviceWorker.register("/push-sw.js", { scope: "/portal/" });
    } catch (err) {
      console.log("Push SW registration failed:", err);
    }
  }
}

setupServiceWorkers().catch((error) => {
  console.log("Service worker setup failed:", error);
});

createRoot(document.getElementById("root")!).render(<App />);
