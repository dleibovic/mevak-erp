import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

const rootElement = document.getElementById("root");

if (rootElement) {
  createRoot(rootElement).render(<App />);
} else {
  document.body.innerHTML = '<div style="padding:16px;color:white;background:#090b10;font-family:system-ui,sans-serif;min-height:100vh;display:flex;align-items:center;justify-content:center">No se pudo iniciar la aplicación.</div>';
}
