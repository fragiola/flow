// The one place the core writes a style: the viewport's transform (D4), written to its element
// directly so the framework never reconciles it, and the root's `touch-action: none`, without
// which a browser takes touches for its own scroll and zoom and cancels every gesture (D10). Only
// these structural properties; the core guard allows `.style` in this file alone.
import type { Viewport } from "../geometry/types";

/** Writes the viewport's transform to its element. */
export function writeViewportTransform(
    element: HTMLElement | SVGElement,
    viewport: Viewport,
): void {
    element.style.transformOrigin = "0 0";
    element.style.transform = `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`;
}

/** Removes what {@link writeViewportTransform} wrote. */
export function clearViewportTransform(
    element: HTMLElement | SVGElement,
): void {
    element.style.removeProperty("transform");
    element.style.removeProperty("transform-origin");
}

/** Keeps the browser's own touch panning and zooming off the root (the engine runs them). */
export function writeRootTouchAction(element: HTMLElement): void {
    element.style.setProperty("touch-action", "none");
}

/** Removes what {@link writeRootTouchAction} wrote. */
export function clearRootTouchAction(element: HTMLElement): void {
    element.style.removeProperty("touch-action");
}
