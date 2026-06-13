/**
 * ErrorBoundary.tsx
 *
 * Tuotannon kaatumissuoja: yhden komponentin virhe ei kaada koko sovellusta.
 * Nayttaa kuljettajalle selkean virheviestin ja "Lataa uudelleen" -napin.
 *
 * Kaytto (App.tsx):
 *   <ErrorBoundary><App /></ErrorBoundary>
 */

import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: "" };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Kirjaa konsoliin - errorLog.ts voi poimia taman myohemmin
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  private handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background p-6">
          <div className="max-w-sm w-full text-center space-y-4">
            <h1 className="text-xl font-black uppercase tracking-wider text-foreground">
              Sovellusvirhe
            </h1>
            <p className="text-sm text-muted-foreground break-words">
              {this.state.message || "Tuntematon virhe"}
            </p>
            <button
              type="button"
              onClick={this.handleReload}
              className="h-12 px-8 rounded-full font-black uppercase tracking-wider text-sm bg-primary text-primary-foreground active:scale-95 transition-all"
            >
              Lataa uudelleen
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
