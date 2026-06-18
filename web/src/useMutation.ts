import { useRef, useState } from "react";

/**
 * The mutation seam every state-changing action in a tab crosses.
 *
 * It owns three things that were previously copied per component (and where one copy — SuccesTab —
 * silently dropped the latch and double-submitted):
 *   - a SYNCHRONOUS re-entrancy latch (a ref), so a rapid double-click can't fire twice before the
 *     `busy`-driven `disabled` prop catches up on the next render;
 *   - `busy`, for button feedback;
 *   - `onSettled`, run once the action resolves (refresh the herd, refetch a plan).
 *
 * `run` returns the resolved value (or `undefined` if a call was already in flight) so a caller can
 * surface an action error after the refresh.
 */
export function useMutation(onSettled?: () => void | Promise<void>) {
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const run = async <T,>(p: Promise<T>): Promise<T | undefined> => {
    if (inFlight.current) return undefined; // a mutation is already running — drop the re-entry
    inFlight.current = true;
    setBusy(true);
    try {
      const r = await p;
      await onSettled?.();
      return r;
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };
  return { busy, run };
}
