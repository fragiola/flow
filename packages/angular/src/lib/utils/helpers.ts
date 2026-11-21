// From Splitter (fragiola/splitter, packages/angular/src/lib/utils/helpers.ts) and Tree
// (fragiola/tree, packages/angular/src/lib/utils/helpers.ts), same author and licence: the host
// element, the boolean and number inputs, the structural style written onto the host. Flow adds
// the defaults a consumer overrides (a handle's place on its side, an SVG part's presentation
// attributes) and the attributes record the engine gives each part.
import {
    afterEveryRender,
    DestroyRef,
    ElementRef,
    effect,
    inject,
    untracked,
} from "@angular/core";

/** The host element of the directive (or component) being created. */
export function injectHost<E extends Element = HTMLElement>(): E {
    return inject<ElementRef<E>>(ElementRef).nativeElement;
}

/** Runs `teardown` when the directive (or component) being created is destroyed. */
export function onDestroy(teardown: () => void): void {
    inject(DestroyRef).onDestroy(teardown);
}

/** `true` for a bare attribute (`<div flowRoot panOnScroll>`), else the value as a boolean. */
export function booleanInput(value: unknown): boolean {
    return value === "" || (value !== "false" && Boolean(value));
}

/** Like {@link booleanInput}, keeping `undefined` (the core's default). */
export function optionalBoolean(value: unknown): boolean | undefined {
    return value === undefined || value === null
        ? undefined
        : booleanInput(value);
}

/** A number input that also takes its attribute's text (`minZoom="0.5"`), keeping `undefined`. */
export function optionalNumber(value: unknown): number | undefined {
    if (value === undefined || value === null || value === "") return undefined;
    const number = typeof value === "number" ? value : Number(value);
    return Number.isNaN(number) ? undefined : number;
}

/**
 * What `read` returns, or `fallback` while a required input it reads is not set yet. A part's
 * `state()` may be read by bindings on its own element (`[class.selected]="n.state().selected"`),
 * and Angular may read a binding before it sets the inputs of its element's directives: the input
 * then throws (NG0950). The read still tracks the input, so the computed that calls this runs
 * again once the input is set.
 */
export function beforeInputs<V>(fallback: V, read: () => V): V {
    try {
        return read();
    } catch (error) {
        if ((error as { code?: unknown } | null)?.code === -950)
            return fallback;
        throw error;
    }
}

/** Structural inline style, camelCase keys (`pointerEvents`): an undefined value leaves the key alone. */
export type StructuralStyle = Readonly<
    Record<string, string | number | undefined>
>;

const kebab = (key: string) =>
    key.startsWith("--")
        ? key
        : key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);

/** A style's keys as CSS properties, with their values as text (`0` is `"0"`). */
function cssEntries(style: StructuralStyle): Map<string, string> {
    const entries = new Map<string, string>();
    for (const [key, value] of Object.entries(style)) {
        if (value !== undefined) entries.set(kebab(key), String(value));
    }
    return entries;
}

/** A length in pixels for an inline style. */
export function px(value: number | undefined): string | undefined {
    return value === undefined ? undefined : `${value}px`;
}

/**
 * Applies a part's structural style to its element, and keeps it applied as it changes: the keys
 * it sets win over the consumer's static `style` (the directive writes them after the element is
 * created; a host style binding would lose to it) and over the consumer's style bindings
 * (`[style.position]`, `[style]`), which Angular writes when they change: every render ends by
 * writing the structural keys back where a binding replaced them. A key it stops setting gets
 * the consumer's value back (the last one a binding wrote). Every other key of the consumer's
 * style is untouched, and so is what the engine writes itself (the viewport's transform, the
 * root's `touch-action`).
 */
export function bindStructuralStyle(
    element: HTMLElement | SVGElement,
    style: () => StructuralStyle,
): void {
    /**
     * the keys set now: their value, as written and as the element reads it back (`0` reads
     * `0px`), and the consumer's value they replaced
     */
    const owned = new Map<
        string,
        { value: string; written: string; previous: string }
    >();
    const write = (name: string, entry: { value: string; written: string }) => {
        element.style.setProperty(name, entry.value);
        entry.written = element.style.getPropertyValue(name);
    };
    /** writes the structural keys back where the consumer's style replaced them */
    const assert = () => {
        for (const [name, entry] of owned) {
            const current = element.style.getPropertyValue(name);
            if (current !== entry.written) {
                entry.previous = current;
                write(name, entry);
            }
        }
    };
    effect(() => {
        const next = cssEntries(style());
        untracked(() => {
            assert();
            for (const [name, { previous }] of owned) {
                if (!next.has(name)) {
                    if (previous === "") {
                        element.style.removeProperty(name);
                    } else {
                        element.style.setProperty(name, previous);
                    }
                    owned.delete(name);
                }
            }
            for (const [name, value] of next) {
                const entry = owned.get(name);
                if (!entry) {
                    const previous = element.style.getPropertyValue(name);
                    const created = { value, written: "", previous };
                    owned.set(name, created);
                    write(name, created);
                } else if (entry.value !== value) {
                    entry.value = value;
                    write(name, entry);
                }
            }
        });
    });
    afterEveryRender({ write: assert });
}

/**
 * Applies a default style the consumer's overrides (a handle's place on its node's side): a key is
 * written only while the element has no value of its own for it (none, or the one written here
 * last), so the consumer's static `style` and style bindings win, and a key the consumer stops
 * setting gets the default back at the next change of the defaults.
 */
export function bindBaseStyle(
    element: HTMLElement | SVGElement,
    style: () => StructuralStyle,
): void {
    const written = new Map<string, string>();
    effect(() => {
        const next = cssEntries(style());
        untracked(() => {
            for (const [name, last] of written) {
                if (next.has(name)) continue;
                if (element.style.getPropertyValue(name) === last) {
                    element.style.removeProperty(name);
                }
                written.delete(name);
            }
            for (const [name, value] of next) {
                const current = element.style.getPropertyValue(name);
                if (current !== "" && current !== written.get(name)) continue;
                element.style.setProperty(name, value);
                written.set(name, element.style.getPropertyValue(name));
            }
        });
    });
}

/** An element's attributes, by name: `undefined` (or absent) removes one. */
export type AttributeRecord = Readonly<Record<string, string | undefined>>;

/**
 * Keeps a part's attributes on its element: the engine's record for the part (`data-flow-part`,
 * `data-flow-id`, its state as `""` or absent) and the part's own (`tabindex`, `d`): sets the ones
 * given, removes the ones no longer given. A host binding is static; these follow the engine
 * (a state attribute comes and goes with a gesture). Never writes `"false"`.
 */
export function bindAttributes(
    element: Element,
    attributes: () => AttributeRecord,
): void {
    let applied = new Set<string>();
    effect(() => {
        const next = attributes();
        untracked(() => {
            const now = new Set<string>();
            for (const [name, value] of Object.entries(next)) {
                if (value === undefined) continue;
                if (element.getAttribute(name) !== value)
                    element.setAttribute(name, value);
                now.add(name);
            }
            for (const name of applied) {
                if (!now.has(name)) element.removeAttribute(name);
            }
            applied = now;
        });
    });
}

/**
 * Applies attributes the consumer overrides (an SVG part's `fill`, an edge path's `d`, a button's
 * `type`): an attribute is written only while the element has none of its own (none, or the value
 * written here last), so the consumer's static attribute or `[attr.*]` binding wins.
 */
export function bindBaseAttributes(
    element: Element,
    attributes: () => AttributeRecord,
): void {
    const written = new Map<string, string>();
    effect(() => {
        const next = attributes();
        untracked(() => {
            for (const [name, value] of Object.entries(next)) {
                const current = element.getAttribute(name);
                if (current !== null && current !== written.get(name)) {
                    written.delete(name);
                    continue;
                }
                if (value === undefined) {
                    if (current !== null) element.removeAttribute(name);
                    written.delete(name);
                    continue;
                }
                if (current !== value) element.setAttribute(name, value);
                written.set(name, value);
            }
        });
    });
}
