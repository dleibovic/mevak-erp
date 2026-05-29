import { Component, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RotateCw } from "lucide-react";

interface State {
  error: Error | null;
}

/**
 * In-app error boundary used around the active route Outlet.
 *
 * Keeps the layout (sidebar / bottom nav / header) mounted so the user can
 * navigate away or retry without being kicked back to the auth recovery shell
 * defined in `main.tsx`.
 */
export class RouteErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error) {
    // Surface to console so it shows up in dev-tools and remote logging.
    // eslint-disable-next-line no-console
    console.error("[RouteErrorBoundary]", error);
  }

  reset = () => {
    this.setState({ error: null });
  };

  reload = () => {
    window.location.reload();
  };

  render() {
    if (!this.state.error) return this.props.children;

    const message = this.state.error.message ?? "Error inesperado";
    const isChunk = /ChunkLoadError|dynamically imported module|Loading chunk/i.test(message);

    return (
      <div className="min-h-[60vh] flex items-center justify-center p-6">
        <div className="max-w-md w-full rounded-lg border border-border/60 bg-card p-6 text-center shadow-card">
          <div className="mx-auto h-12 w-12 rounded-full bg-warning/15 text-warning flex items-center justify-center mb-4">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <h2 className="text-lg font-semibold mb-1">No pudimos cargar esta vista</h2>
          <p className="text-sm text-muted-foreground mb-4">
            {isChunk
              ? "Falló la descarga de un recurso (probablemente por conexión inestable). Probá de nuevo."
              : message}
          </p>
          <div className="flex gap-2 justify-center">
            <Button onClick={this.reset} variant="outline" size="sm">
              <RotateCw className="h-4 w-4 mr-2" /> Reintentar
            </Button>
            <Button onClick={this.reload} size="sm">Recargar página</Button>
          </div>
        </div>
      </div>
    );
  }
}
