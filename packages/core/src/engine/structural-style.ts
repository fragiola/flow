// The one place the core writes a style (D4): the viewport's transform, written to its element
// directly so the framework never reconciles it. Only `transform` and `transform-origin`, both
// structural; the core guard allows `.style` in this file alone.
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
