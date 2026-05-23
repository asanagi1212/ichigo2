import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "./styles.css";

const isLocalhost =
  typeof window !== "undefined" &&
  ["localhost", "127.0.0.1", "::1"].includes(window.location.hostname);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", async () => {
    if (isLocalhost) {
      const registrations = await navigator.serviceWorker.getRegistrations().catch(() => []);
      await Promise.all(registrations.map((registration) => registration.unregister()));
      return;
    }

    navigator.serviceWorker.register("/sw.js").catch((error) => {
      console.error("Failed to register service worker", error);
    });
  });
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
