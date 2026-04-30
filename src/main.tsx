import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

const recoveryMarkup = `
  <div style="padding:24px;color:hsl(40 20% 96%);background:hsl(220 14% 6%);font-family:system-ui,-apple-system,BlinkMacSystemFont,sans-serif;min-height:100vh;display:flex;align-items:center;justify-content:center;text-align:center">
    <div style="max-width:360px">
      <div style="width:48px;height:48px;border-radius:12px;background:hsl(35 95% 60%);margin:0 auto 18px"></div>
      <h1 style="font-size:24px;margin:0 0 8px">Mevak ERP</h1>
      <p style="color:hsl(220 8% 70%);margin:0 0 18px">No se pudo iniciar la aplicación en este navegador.</p>
      <button onclick="window.location.href='/auth'" style="width:100%;border:0;border-radius:8px;background:hsl(35 95% 60%);color:hsl(220 25% 8%);padding:12px 16px;font-size:16px">Ir al login</button>
      <button onclick="window.location.reload()" style="width:100%;border:1px solid hsl(220 12% 22%);border-radius:8px;background:transparent;color:inherit;padding:12px 16px;font-size:16px;margin-top:10px">Recargar</button>
    </div>
  </div>
`;

class RootErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean }> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return <div dangerouslySetInnerHTML={{ __html: recoveryMarkup }} />;
    }

    return this.props.children;
  }
}

window.addEventListener("error", () => {
  const root = document.getElementById("root");
  if (root && !root.hasChildNodes()) root.innerHTML = recoveryMarkup;
});

window.addEventListener("unhandledrejection", () => {
  const root = document.getElementById("root");
  if (root && !root.hasChildNodes()) root.innerHTML = recoveryMarkup;
});

const rootElement = document.getElementById("root");

if (rootElement) {
  createRoot(rootElement).render(<RootErrorBoundary><App /></RootErrorBoundary>);
} else {
  document.body.innerHTML = recoveryMarkup;
}
