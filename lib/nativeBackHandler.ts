/**
 * Hardware-back coordination for the standalone Android app.
 *
 * Overlays (modals, sheets, drawers) that do NOT route themselves through
 * WebView history (MobileDrawer pushes a history entry; these do not) register
 * a close handler here on mount. The single global Capacitor backButton
 * listener (components/native/NativeBackButton.tsx) consults the TOPMOST
 * handler first: if one consumes the press, the overlay closes itself and
 * WebView history (and app exit) is untouched. On the web nothing ever calls
 * consumeNativeBack, so registering is inert there.
 *
 * The stack guarantees the rule "a modal/drawer closes before any navigation":
 * only the topmost overlay is asked, one press closes exactly one layer.
 */
export type NativeBackHandler = () => boolean;

const stack: NativeBackHandler[] = [];

/** Register an overlay close handler; returns its unregister function. */
export function registerBackHandler(handler: NativeBackHandler): () => void {
  stack.push(handler);
  return () => {
    const index = stack.lastIndexOf(handler);
    if (index !== -1) stack.splice(index, 1);
  };
}

/**
 * Give the topmost overlay a chance to consume the hardware back press.
 * Returns true when an overlay handled it (navigation must not happen).
 */
export function consumeNativeBack(): boolean {
  const handler = stack[stack.length - 1];
  if (!handler) return false;
  try {
    return handler() === true;
  } catch {
    return false;
  }
}
