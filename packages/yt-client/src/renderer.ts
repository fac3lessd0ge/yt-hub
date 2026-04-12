import "./globals.css";
import { createElement } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { SettingsProvider } from "./hooks/useSettings";

const container = document.getElementById("root");
if (container) {
  const root = createRoot(container);
  root.render(
    createElement(
      ErrorBoundary,
      null,
      createElement(SettingsProvider, null, createElement(App)),
    ),
  );
}
