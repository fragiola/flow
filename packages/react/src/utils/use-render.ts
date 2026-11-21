// From Splitter (fragiola/splitter, packages/react/src/utils/use-render.ts), same author and
// licence; generic over the element (Flow's edges are SVG), with a default style the consumer's
// overrides (`baseStyle`: a handle's place on its node's side).
import * as React from "react";
import { mergeProps } from "./merge-props";

/** A callback ref that forwards to every ref in `refs` (function refs and ref objects alike). */
function mergeRefs<T>(
    ...refs: (React.Ref<T> | undefined)[]
): React.RefCallback<T> {
    return (value) => {
        const cleanups = refs.map((ref) => {
            if (typeof ref === "function") {
                const cleanup = ref(value);
                return typeof cleanup === "function"
                    ? cleanup
                    : () => ref(null);
            }
            if (ref) {
                ref.current = value;
                return () => {
                    ref.current = null;
                };
            }
            return undefined;
        });
        return () => {
            for (const cleanup of cleanups) {
                cleanup?.();
            }
        };
    };
}

/**
 * Props a `render` function receives: spread them onto the element it returns. `ref` is a callback
 * ref, so it fits any element's `ref` (`render={(props) => <section {...props} />}` needs no cast).
 */
export type RenderedProps<E extends Element = HTMLElement> =
    (E extends SVGElement
        ? React.SVGAttributes<E>
        : React.HTMLAttributes<E>) & {
        ref: React.RefCallback<E>;
        [dataAttribute: `data-${string}`]: string | undefined;
    };

/**
 * Replaces the element a primitive renders, Base UI style: either an element whose props are
 * merged with the primitive's (`render={<section />}`), or a function receiving the props and
 * the primitive's state (`render={(props, state) => <section {...props} />}`).
 */
export type RenderProp<State, E extends Element = HTMLElement> =
    | React.ReactElement
    | ((props: RenderedProps<E>, state: State) => React.ReactElement);

/** The props every primitive accepts on top of the element's own. */
export interface PrimitiveProps<State, E extends Element = HTMLElement> {
    /** replaces the rendered element (never `asChild`) */
    render?: RenderProp<State, E> | undefined;
    /** a class name, or a function of the primitive's state returning one */
    className?: string | ((state: State) => string | undefined) | undefined;
    /**
     * a style, or a function of the primitive's state returning one. Structural keys the
     * primitive sets (position, its place, its size) always win.
     */
    style?:
        | React.CSSProperties
        | ((state: State) => React.CSSProperties | undefined)
        | undefined;
    ref?: React.Ref<E> | undefined;
}

/** The props of a primitive that renders a `div` by default. */
export type DivPrimitiveProps<State> = PrimitiveProps<State, HTMLDivElement> &
    Omit<React.HTMLAttributes<HTMLDivElement>, "className" | "style">;

/** The props of a primitive that renders a `button` by default. */
export type ButtonPrimitiveProps<State> = PrimitiveProps<
    State,
    HTMLButtonElement
> &
    Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "className" | "style">;

/** The props of a primitive that renders an SVG element `E` by default. */
export type SvgPrimitiveProps<State, E extends SVGElement> = PrimitiveProps<
    State,
    E
> &
    Omit<React.SVGAttributes<E>, "className" | "style">;

/** A part's `data-*` attributes, as a hook's `props` carry them. */
export type DataAttributes = {
    readonly [name: `data-${string}`]: string | undefined;
};

type AnyProps = Record<string, unknown>;

interface RenderOptions<State> {
    state: State;
    /** the primitive's own props: ARIA, data-*, handlers, children */
    props: Record<string, unknown>;
    /** the primitive's ref, merged with the consumer's */
    ref?: React.Ref<Element> | undefined;
    /** structural style: always wins over the consumer's */
    style?: React.CSSProperties | undefined;
    /** a default style the consumer's overrides */
    baseStyle?: React.CSSProperties | undefined;
}

/**
 * Renders a primitive's element: resolves `className`/`style` functions against the state,
 * merges the consumer's props over the primitive's (handlers composed, internal first; structural
 * style keys win), merges refs, and applies `render`.
 */
export function useRenderElement<State, E extends Element>(
    tag: keyof React.JSX.IntrinsicElements,
    componentProps: PrimitiveProps<State, E>,
    options: RenderOptions<State>,
): React.JSX.Element {
    const {
        render,
        className,
        style,
        ref: externalRef,
        ...external
    } = componentProps as PrimitiveProps<State, E> & AnyProps;
    const internalRef = options.ref as React.Ref<E> | undefined;
    // the render element's own ref joins the merge; memoized so React does not detach and
    // re-attach the refs (and the primitive's registrations) on every render
    const renderElement =
        render && typeof render !== "function"
            ? (render as React.ReactElement<AnyProps>)
            : undefined;
    const elementRef = renderElement?.props.ref as React.Ref<E> | undefined;
    // consumer refs are read when the element attaches, not memoized on their identity: an inline
    // callback ref (a new function each render) must not make React detach and re-attach the
    // primitive's own ref (and its registrations) on every render
    const consumerRefs = React.useRef<(React.Ref<E> | undefined)[]>([]);
    consumerRefs.current = [externalRef, elementRef];
    // (a consumer ref that appears later re-attaches once, so it is called)
    const hasConsumerRef = externalRef != null || elementRef != null;
    const ref = React.useMemo<React.RefCallback<E>>(
        () => (element: E | null) =>
            mergeRefs(
                internalRef,
                ...(hasConsumerRef ? consumerRefs.current : []),
            )(element),
        [internalRef, hasConsumerRef],
    );

    const resolvedClassName =
        typeof className === "function" ? className(options.state) : className;
    const resolvedStyle =
        typeof style === "function" ? style(options.state) : style;

    const props = mergeProps(options.props, external);
    if (resolvedClassName !== undefined) {
        props.className = resolvedClassName;
    }
    if (resolvedStyle || options.style || options.baseStyle) {
        props.style = {
            ...options.baseStyle,
            ...resolvedStyle,
            ...options.style,
        };
    }
    props.ref = ref;

    if (typeof render === "function") {
        return render(props as unknown as RenderedProps<E>, options.state);
    }
    if (renderElement) {
        const elementProps = renderElement.props;
        const merged = mergeProps(props, elementProps);
        if (elementProps.style || props.style) {
            merged.style = {
                ...options.baseStyle,
                ...(elementProps.style as React.CSSProperties),
                ...resolvedStyle,
                ...options.style,
            };
        }
        merged.ref = ref;
        return React.cloneElement(renderElement, merged);
    }
    return React.createElement(tag, props);
}
