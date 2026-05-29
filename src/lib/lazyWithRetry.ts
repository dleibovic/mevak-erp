import { lazy, type ComponentType } from "react";

/**
 * lazy() with automatic retry on chunk load failures.
 *
 * Mobile networks (and aggressive caches after a redeploy) often surface
 * "ChunkLoadError" / "Failed to fetch dynamically imported module" when the
 * user navigates between routes. Without retry, that error bubbles up to the
 * top-level error boundary and the user sees the recovery shell.
 */
export function lazyWithRetry<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>,
  retries = 2,
  delayMs = 400,
): ReturnType<typeof lazy<T>> {
  return lazy(async () => {
    let lastError: unknown;
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        return await factory();
      } catch (err) {
        lastError = err;
        const message = (err as Error)?.message ?? "";
        const isChunkError =
          /ChunkLoadError|Failed to fetch dynamically imported module|Importing a module script failed|Loading chunk \d+ failed/i.test(
            message,
          );
        if (!isChunkError || attempt === retries) break;
        await new Promise((r) => setTimeout(r, delayMs * (attempt + 1)));
      }
    }
    throw lastError;
  });
}
