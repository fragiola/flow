// Where a part's element is: React renders a part conditionally (`null`) or into a portal; an
// Angular attribute directive is on the app's own element, so the directive moves that element
// instead: out of the document while the part is not shown (a connection line between
// connections), into another element while it is (an edge label into the edges' HTML layer, a
// toolbar into the root), back to its place otherwise. A comment keeps its place meanwhile.
import { effect, untracked } from "@angular/core";
import { onDestroy } from "./helpers";

/** The text of the comment that keeps a moved element's place (`defaultContent` counts it as content). */
export const PLACEHOLDER = "flow-part";

/** Where an element goes: its own place (`"here"`), into another element, or nowhere (`null`). */
export type Presence = "here" | Element | null;

/**
 * Keeps `element` where `where()` says, as it changes; on destroy, its place's comment goes, and
 * an element moved elsewhere goes too (its view no longer holds it).
 */
export function bindPresence(element: Element, where: () => Presence): void {
    let placeholder: Comment | undefined;
    /** the element leaves its place: a comment takes it */
    const leave = () => {
        if (placeholder?.parentNode) return;
        placeholder ??= element.ownerDocument.createComment(PLACEHOLDER);
        element.before(placeholder);
    };
    effect(() => {
        const next = where();
        untracked(() => {
            if (next === "here") {
                if (placeholder?.parentNode) placeholder.replaceWith(element);
                return;
            }
            if (!placeholder?.parentNode && element.parentNode) leave();
            if (next === null) {
                element.remove();
            } else if (element.parentNode !== next) {
                next.append(element);
            }
        });
    });
    onDestroy(() => {
        if (placeholder?.parentNode) {
            placeholder.remove();
            element.remove();
        }
    });
}
