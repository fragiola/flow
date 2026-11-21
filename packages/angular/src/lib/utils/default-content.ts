// What a primitive renders when given no children in React (`Flow.Edge`'s `Flow.EdgePath`, a
// `NodeResizer`'s eight handles, the minimap's nodes and mask, the connection line's path): an
// attribute directive renders nothing, so it adds those elements to the app's element itself when
// the app wrote no element inside it, once rendered.
import {
    afterNextRender,
    Injector,
    inject,
    runInInjectionContext,
} from "@angular/core";
import { onDestroy } from "./helpers";
import { PLACEHOLDER } from "./presence";

/**
 * Once rendered, when `element` holds no element of the app's (nor one moved away), `create(document)` gives the
 * elements to add (run in the directive's injection context: their bindings live with it); they
 * go with the directive.
 */
export function defaultContent(
    element: Element,
    create: (document: Document) => readonly Element[],
): void {
    const injector = inject(Injector);
    let added: readonly Element[] = [];
    afterNextRender(() => {
        // an element of the app's, or one moved away (a label, a toolbar): content
        const written = [...element.childNodes].some(
            (node) =>
                node.nodeType === node.ELEMENT_NODE ||
                (node.nodeType === node.COMMENT_NODE &&
                    node.nodeValue === PLACEHOLDER),
        );
        if (written) return;
        added = runInInjectionContext(injector, () =>
            create(element.ownerDocument),
        );
        element.append(...added);
    });
    onDestroy(() => {
        for (const child of added) child.remove();
    });
}
