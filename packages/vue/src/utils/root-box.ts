// The root's box, read once while the nodes layer patches. The engine reads the root's client box
// on each read that needs the view (`getBoundingClientRect`, for `node-z-index-by`'s levels, the
// visible lists). React reads in its render, before any DOM change; Vue renders each new node
// right after inserting the one before, so each of their reads forced a style and layout of the
// page (hundreds per frame on a zoom out). Nodes inserted in the viewport never change the root's
// box, so while the layer patches the root answers with the box it read first.

/** @internal a root element's box hold: `hold` until the end of the current task's microtasks */
export interface RootBoxHold {
    /** reads the root's box once until the current microtask checkpoint (the patch's end) */
    hold(): void;
    /** gives the element its own `getBoundingClientRect` back */
    release(): void;
}

/** @internal installs the hold on the root's element (an own property shadowing the prototype's) */
export function holdRootBox(element: HTMLElement): RootBoxHold {
    const own = Object.getOwnPropertyDescriptor(
        element,
        "getBoundingClientRect",
    );
    let held = false;
    let box: DOMRect | undefined;
    const read = (): DOMRect =>
        Element.prototype.getBoundingClientRect.call(element);
    Object.defineProperty(element, "getBoundingClientRect", {
        configurable: true,
        writable: true,
        value: (): DOMRect => {
            if (!held) return read();
            box ??= read();
            return box;
        },
    });
    return {
        hold() {
            if (held) return;
            held = true;
            box = undefined;
            queueMicrotask(() => {
                held = false;
                box = undefined;
            });
        },
        release() {
            held = false;
            box = undefined;
            if (own)
                Object.defineProperty(element, "getBoundingClientRect", own);
            else
                delete (element as { getBoundingClientRect?: unknown })
                    .getBoundingClientRect;
        },
    };
}
