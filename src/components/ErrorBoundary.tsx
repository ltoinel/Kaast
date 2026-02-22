/**
 * ErrorBoundary — Catches rendering errors inside a tab panel and shows a
 * recoverable fallback UI instead of crashing the whole application.
 */
import { Component, type ReactNode, type ErrorInfo } from "react";
import i18n from "../i18n";

interface ErrorBoundaryProps {
  /** Display name for the wrapped section (used in logging). */
  name: string;
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, errorMessage: "" };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, errorMessage: error.message || "" };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error(`[ErrorBoundary:${this.props.name}]`, error, info.componentStack);
  }

  /** Reset error state so the children can be re-mounted. */
  private handleRetry = () => {
    this.setState({ hasError: false, errorMessage: "" });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: "flex", flexDirection: "column", alignItems: "center",
          justifyContent: "center", height: "100%", gap: "12px",
          color: "var(--text-muted)", textAlign: "center", padding: "2rem",
        }}>
          <h3 style={{ color: "var(--accent-error)", margin: 0 }}>
            {i18n.t("errorBoundary.title")}
          </h3>
          <p style={{ fontSize: "0.85rem", maxWidth: 400, margin: 0 }}>
            {this.state.errorMessage || i18n.t("errorBoundary.unknown")}
          </p>
          <button className="btn btn-primary btn-sm" onClick={this.handleRetry}>
            {i18n.t("errorBoundary.retry")}
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
