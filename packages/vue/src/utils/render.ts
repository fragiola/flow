// From Tree (fragiola/tree, packages/vue/src/utils/render.ts), same author and licence. Flow adds
// a default style the consumer's overrides (`baseStyle`: a handle's place on its node's side).
// `class` and `style` are values only: Vue normalizes both when it creates a node (a template's
// `:class` too), so a function of the state (the React adapter's) never reaches a primitive; the
// state is the `render` slot's, the default slot's (`{ state }`) and the `data-*` attributes'.
import {
    type Component,
    type CSSProperties,
    camelize,
    type FunctionalComponent,
    getCurrentInstance,
    h,
    mergeProps,
    normalizeStyle,
    onBeforeMount,
    type Slot,
    type VNode,
    type VNodeChild,
} from "vue";

/** A length in pixels for an inline style (Vue, unlike React, adds no unit to a number). */
export function px(value: number): string {
    return `${value}px`;
}

/** The element behind a template ref: the element itself, or a component's root element. */
export function toElement(value: unknown): Element | null {
    if (value === null || typeof value !== "object") {
        return null;
    }
    // `nodeType`, not `instanceof HTMLElement`: an element may belong to another window (an iframe)
    if ((value as { nodeType?: unknown }).nodeType === 1) {
        return value as Element;
    }
    const root = (value as { $el?: unknown }).$el;
    return root !== null &&
        typeof root === "object" &&
        (root as { nodeType?: unknown }).nodeType === 1
        ? (root as Element)
        : null;
}

/** A function template ref, as a primitive puts it on its element. */
export type ElementRef = (value: unknown) => void;

/**
 * A function template ref that calls `attach` with the element once it is mounted, and the
 * cleanup it returns when the element goes away or `deps` change (then `attach` runs again). Vue
 * calls a function ref on every patch; only a change reaches `attach`. A primitive whose `attach`
 * needs the engine reads `context.engine.value` in its render, so it patches (and calls its ref
 * again) once the engine is there.
 */
export function elementRef(
    attach: (element: Element) => (() => void) | undefined,
    deps: () => readonly unknown[] = () => [],
): ElementRef {
    let current: Element | null = null;
    let currentDeps: readonly unknown[] = [];
    let cleanup: (() => void) | undefined;
    return (value: unknown) => {
        const element = toElement(value);
        // an element going away needs no deps: its node may be gone from the model already
        const next = element ? deps() : [];
        if (
            element === current &&
            next.length === currentDeps.length &&
            next.every((dep, i) => Object.is(dep, currentDeps[i]))
        ) {
            return;
        }
        cleanup?.();
        cleanup = undefined;
        current = element;
        currentDeps = next;
        if (element) {
            cleanup = attach(element);
        }
    };
}

/**
 * Runs `start` on the client only: before the component mounts (a server render never mounts, so
 * it never subscribes to anything it could not unsubscribe from), or at once outside a component.
 */
export function onClient(start: () => void): void {
    if (getCurrentInstance()) {
        onBeforeMount(start);
    } else {
        start();
    }
}

/** A component (or a tag) a primitive renders instead of its own element: the `as` prop. */
export type AsProp = string | Component;

/** What a primitive's `render` scoped slot receives. */
export interface RenderSlotProps<State> {
    /**
     * what goes on your element (`v-bind="props"`): the primitive's `data-*`, listeners, its
     * structural style merged over your `class`/`style`, and its template ref
     */
    props: Record<string, unknown>;
    /** the primitive's state */
    state: State;
    /**
     * the primitive's content, as a node of one stable component (`<component :is="children" />`,
     * or `h(children)`): its type never changes between renders, so the content never remounts
     */
    children: VNode;
}

/** Renders a primitive's content inside its `render` slot: one component type for every render. */
const PrimitiveChildren: FunctionalComponent<{
    content?: (() => VNodeChild) | undefined;
}> = (props) => props.content?.();
PrimitiveChildren.props = ["content"];

/** The slots every primitive accepts: `render` replaces its element. */
export interface RenderSlot<State> {
    /** replaces the rendered element (never `asChild`): bind `props` on your own element */
    render?: (scope: RenderSlotProps<State>) => VNode[];
}

interface RenderOptions<State> {
    /** the element rendered by default */
    tag: string;
    /** the consumer's `as` prop */
    as?: AsProp | undefined;
    /** the consumer's fallthrough attributes: `class`, `style`, listeners, ARIA, … */
    attrs: Record<string, unknown>;
    /** the consumer's `render` slot */
    render?: Slot | undefined;
    state: State;
    /** the primitive's own props: data-*, listeners, SVG attributes */
    props: Record<string, unknown>;
    /** the primitive's template ref */
    ref?: ElementRef | undefined;
    /** structural style: always wins over the consumer's */
    style?: CSSProperties | Record<string, unknown> | undefined;
    /** a default style the consumer's overrides */
    baseStyle?: CSSProperties | Record<string, unknown> | undefined;
    /** the primitive's content */
    children?: (() => VNodeChild) | undefined;
}

/**
 * Renders a primitive's element: merges the consumer's attributes over the primitive's (listeners
 * composed, internal first; classes joined; structural style keys win over the consumer's, which
 * win over the default ones), puts the primitive's template ref on it, and applies `as` or the
 * `render` slot.
 */
export function renderElement<State>(
    options: RenderOptions<State>,
): VNodeChild {
    const { attrs, state, children } = options;
    const { style: consumerStyle, ...external } = attrs;
    const merged = mergeProps(options.props, external);
    // structural keys win, an undefined one included (it removes the consumer's, as in React)
    const style: Record<string, unknown> = {
        ...options.baseStyle,
        ...styleObject(consumerStyle),
        ...options.style,
    };
    for (const [key, value] of Object.entries(style)) {
        if (value === undefined) {
            delete style[key];
        }
    }
    if (Object.keys(style).length > 0) {
        merged.style = style;
    }
    if (options.ref) {
        merged.ref = options.ref;
    }
    if (options.render) {
        return options.render({
            props: merged,
            state,
            children: h(PrimitiveChildren, { content: children }),
        } satisfies RenderSlotProps<State>);
    }
    const as = options.as ?? options.tag;
    if (typeof as === "string") {
        return h(as, merged, children ? [children()] : undefined);
    }
    return h(as, merged, children ? { default: children } : undefined);
}

/**
 * A consumer's `style` (an object, an array or a CSS string) as one object with camelCase keys
 * (custom properties kept), so the structural keys can win over it.
 */
export function styleObject(style: unknown): Record<string, unknown> {
    const normalized = normalizeStyle(style);
    const result: Record<string, unknown> = {};
    if (typeof normalized === "string") {
        for (const declaration of normalized.split(/;(?![^(]*\))/g)) {
            const index = declaration.indexOf(":");
            if (index > 0) {
                const name = declaration.slice(0, index).trim();
                result[name.startsWith("--") ? name : camelize(name)] =
                    declaration.slice(index + 1).trim();
            }
        }
    } else if (normalized) {
        for (const [name, value] of Object.entries(normalized)) {
            result[name.startsWith("--") ? name : camelize(name)] = value;
        }
    }
    return result;
}
