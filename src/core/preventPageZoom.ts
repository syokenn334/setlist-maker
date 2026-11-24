/**
 * Keeps the app UI at 100%: blocks browser zoom by ctrl / cmd + wheel (and trackpad pinch, which
 * Chromium and Firefox report the same way), ctrl / cmd + "+" "-" "0", and Safari's gesture events.
 * Touch pinch is blocked by `touch-action: pan-x pan-y` (global.css) and the viewport meta tag.
 * The preview and the style editor handle these gestures themselves to zoom the image.
 */
export function preventPageZoom(): void {
  window.addEventListener('wheel', (e) => { if (e.ctrlKey || e.metaKey) e.preventDefault(); }, { passive: false });
  window.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && ['+', '-', '=', '0', ';'].includes(e.key)) e.preventDefault();
  });
  for (const type of ['gesturestart', 'gesturechange']) document.addEventListener(type, (e) => e.preventDefault());
}
