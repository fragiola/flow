// How a primitive builds the props of its element (S2, S3): the consumer's attributes merged over
// the primitive's own (handlers composed, internal first; attachments of both kept), `class` and
// `style` given as a value or as a function of the state, structural style keys that always win
// over the consumer's (which win over the default ones), and the `render` snippet that replaces
// the element: it receives `{ props, state, children }` and spreads `props` on its own element.
// Svelte never normalizes a component's props, so React's `className` / `style` functions of the
// state work here too.
import type { Snippet } from "svelte";
import { type Attachment, createAttachmentKey } from "svelte/attachments";
import type {
    ClassValue,
    HTMLAttributes,
    HTMLButtonAttributes,
    SVGAttributes,
} from "svelte/elements";
import { mergeProps } from "./merge-props.js";

/** A style as a primitive takes it: a CSS string or a record of properties (camelCase or kebab-case). */
export type StyleValue =
    | string
    | Readonly<Record<string, string | number | null | undefined>>;

/** The structural style a primitive writes: kebab-case properties (`undefined` removes one). */
export type StyleRecord = Readonly<Record<string, string | number | undefined>>;

/**
 * Props a `render` snippet receives as `props`: spread them onto the element it renders
 * (`<section {...props}>`). They carry the primitive's attachment, which registers the element.
 */
export type RenderedProps<E extends Element = HTMLElement> =
    (E extends SVGElement ? SVGAttributes<E> : HTMLAttributes<E>) & {
        [dataAttribute: `data-${string}`]: string | undefined;
    };

/** What a primitive's `render` snippet receives. */
export interface RenderSnippetProps<State, E extends Element = HTMLElement> {
    /** what goes on your element (`{...props}`): attributes, handlers, style, the attachment */
    props: RenderedProps<E>;
    /** the primitive's state */
    state: State;
    /** the primitive's content: render it inside your element (`{@render children()}`) */
    children: Snippet;
}

/** Replaces the element a primitive renders (never `asChild`): a snippet of `{ props, state, children }`. */
export type RenderSnippet<State, E extends Element = HTMLElement> = Snippet<
    [RenderSnippetProps<State, E>]
>;

/** The props every primitive accepts on top of the element's own. */
export interface PrimitiveProps<State, E extends Element = HTMLElement> {
    /** replaces the rendered element (never `asChild`) */
    render?: RenderSnippet<State, E> | undefined;
    /** a class (any of Svelte's forms), or a function of the primitive's state returning one */
    class?: ClassValue | ((state: State) => ClassValue) | null | undefined;
    /**
     * a style (a CSS string or a record), or a function of the primitive's state returning one.
     * Structural keys the primitive sets (position, its place, its size) always win.
     */
    style?: StyleValue | ((state: State) => StyleValue | undefined) | undefined;
    /** the rendered element, once mounted (`bind:ref`) */
    ref?: E | null | undefined;
}

type ElementAttributes<E extends Element> = E extends SVGElement
    ? SVGAttributes<E>
    : E extends HTMLButtonElement
      ? HTMLButtonAttributes
      : HTMLAttributes<E>;

/** The props of a primitive rendering an element `E` (a `div` by default). */
export type ElementPrimitiveProps<
    State,
    E extends Element = HTMLDivElement,
> = PrimitiveProps<State, E> &
    Omit<ElementAttributes<E>, "class" | "style" | "children">;

/** The props of a primitive that renders a `div` by default. */
export type DivPrimitiveProps<State> = ElementPrimitiveProps<
    State,
    HTMLDivElement
>;

/** The props of a primitive that renders a `button` by default. */
export type ButtonPrimitiveProps<State> = ElementPrimitiveProps<
    State,
    HTMLButtonElement
>;

/** The props of a primitive that renders an SVG element `E` by default. */
export type SvgPrimitiveProps<
    State,
    E extends SVGElement,
> = ElementPrimitiveProps<State, E>;

/** A part's `data-*` attributes, as a rune's `props` carry them. */
export type DataAttributes = {
    readonly [name: `data-${string}`]: string | undefined;
};

type AnyProps = Record<string | symbol, unknown>;

/** `fontSize` → `font-size` (a custom property and a kebab-case name stay). */
function cssName(name: string): string {
    return name.startsWith("--")
        ? name
        : name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
}

/** A consumer's style (a CSS string or a record) as one record of kebab-case properties. */
export function styleRecord(
    style: StyleValue | null | undefined,
): Record<string, string | number> {
    const result: Record<string, string | number> = {};
    if (typeof style === "string") {
        for (const declaration of style.split(/;(?![^(]*\))/g)) {
            const index = declaration.indexOf(":");
            if (index > 0) {
                result[cssName(declaration.slice(0, index).trim())] =
                    declaration.slice(index + 1).trim();
            }
        }
    } else if (style) {
        for (const [name, value] of Object.entries(style)) {
            if (value !== undefined && value !== null) {
                result[cssName(name)] = value;
            }
        }
    }
    return result;
}

/** A record of kebab-case properties as a CSS string (`undefined`: nothing). */
export function styleString(
    record: Readonly<Record<string, string | number | undefined>>,
): string | undefined {
    const declarations = Object.entries(record)
        .filter(([, value]) => value !== undefined)
        .map(([name, value]) => `${name}: ${value}`);
    return declarations.length > 0 ? declarations.join("; ") : undefined;
}

/** A length in pixels for an inline style. */
export function px(value: number): string {
    return `${value}px`;
}

interface ElementOptions<State> {
    /** the consumer's props: `class`, `style`, handlers, ARIA, attachments, … */
    rest: object;
    /** the consumer's `class` (a value or a function of the state) */
    className?: PrimitiveProps<State>["class"];
    /** the consumer's `style` (a value or a function of the state) */
    style?: PrimitiveProps<State>["style"];
    state: State;
    /** the primitive's own props: data-*, handlers, SVG attributes, its attachment */
    own: object;
    /** structural style: always wins over the consumer's */
    structural?: StyleRecord | undefined;
    /** a default style the consumer's overrides */
    baseStyle?: StyleRecord | undefined;
}

/**
 * The props of a primitive's element: the consumer's over the primitive's (handlers composed,
 * internal first; attachments kept), the class and the style resolved against the state, the
 * structural style keys over the consumer's (an `undefined` one removes the consumer's), the
 * consumer's over the default ones.
 */
export function elementProps<State, E extends Element = HTMLElement>(
    options: ElementOptions<State>,
): RenderedProps<E> {
    const { state } = options;
    const props = mergeProps(options.own as AnyProps, options.rest as AnyProps);
    const className =
        typeof options.className === "function"
            ? options.className(state)
            : options.className;
    if (className !== undefined && className !== null) {
        props.class = className;
    }
    const consumer =
        typeof options.style === "function"
            ? options.style(state)
            : options.style;
    const style: Record<string, string | number | undefined> = {
        ...options.baseStyle,
        ...styleRecord(consumer),
        ...options.structural,
    };
    const css = styleString(style);
    if (css !== undefined) {
        props.style = css;
    } else {
        delete props.style;
    }
    return props as unknown as RenderedProps<E>;
}

/**
 * The attachment that gives the consumer's `ref` (`bind:ref`) the element, as the props a
 * primitive spreads: it runs once the element is mounted, whether the element is the primitive's
 * own or the one its `render` snippet renders, and gives `null` when it goes.
 */
export function refProps(
    set: (element: Element | null) => void,
): Record<symbol, Attachment<Element>> {
    return {
        [createAttachmentKey()]: (element) => {
            set(element);
            return () => set(null);
        },
    };
}
