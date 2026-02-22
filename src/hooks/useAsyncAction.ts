/**
 * useAsyncAction — Reusable hook for async operations with loading/error state.
 *
 * Wraps any `async () => void` function with automatic isLoading toggling
 * and error capture via getTauriErrorMessage.
 */
import { useState, useCallback } from "react";
import { getTauriErrorMessage } from "../utils/tauri";

export interface AsyncAction {
  isLoading: boolean;
  error: string;
  setError: (msg: string) => void;
  clearError: () => void;
  /** Execute an async function with automatic loading/error management. */
  run: (fn: () => Promise<void>) => Promise<void>;
}

/**
 * Provide loading and error state for a single async action.
 *
 * @returns An object with `isLoading`, `error`, helper setters, and a `run` wrapper.
 */
export function useAsyncAction(): AsyncAction {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const clearError = useCallback(() => setError(""), []);

  const run = useCallback(async (fn: () => Promise<void>) => {
    setIsLoading(true);
    setError("");
    try {
      await fn();
    } catch (err) {
      setError(getTauriErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { isLoading, error, setError, clearError, run };
}
