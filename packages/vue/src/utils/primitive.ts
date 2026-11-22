// From Tree (fragiola/tree, packages/vue/src/utils/primitive.ts), same author and licence.
// How a primitive is defined in Vue: its props, its scoped slots, its events (`Flow.Root`'s
// `update:*`, for `v-model`), `inheritAttrs: false` (it merges the fallthrough attributes itself,
// under its structural style). Flow adds props of other types than one (`fitView`: true or a
// payload).
import {
    type DefineSetupFnComponent,
    defineComponent,
    type ObjectEmitsOptions,
    type Prop,
    type PropType,
    type SlotsType,
    type VNode,
    type VNodeChild,
} from "vue";
import type { AsProp } from "./render";

/** A slot function: what a scoped slot of a primitive receives, and the nodes it renders. */
export type SlotFunction<Scope> = (scope: Scope) => VNode[];

/** No events: every listener a primitive takes is a fallthrough attribute. */
export type NoEmits = Record<never, never>;

/**
 * A primitive's public type: a component taking `Props` (plus any fallthrough attribute: `class`,
 * `style`, listeners, ARIA, `data-*`) with the scoped slots `Slots` and the events `Emits`. Typed
 * by the registry `T` through each part's props, and through `typedFlow<T, F>()` for a template.
 */
export type FlowComponent<
    Props extends object,
    Slots extends object,
    Emits extends ObjectEmitsOptions = NoEmits,
> = DefineSetupFnComponent<Props, Emits, SlotsType<Slots>>;

/** The props every primitive accepts on top of its own: `as` replaces its element. */
export interface PrimitiveProps {
    /** the tag or component rendered instead of the primitive's element (never `asChild`) */
    as?: AsProp | undefined;
}

/** What a primitive's setup receives with its props. */
export interface PrimitiveContext<Slots> {
    /** the fallthrough attributes: `class`, `style`, listeners, ARIA, `data-*`, … */
    attrs: Record<string, unknown>;
    slots: { readonly [K in keyof Slots]?: Slots[K] };
    /** emits one of the primitive's events */
    emit: (event: string, ...args: unknown[]) => void;
}

/**
 * The Vue props options of a primitive's props. The names in `booleans` are cast the way Vue casts
 * a boolean prop, so a bare attribute is `true` (`<Flow.Root pan-on-scroll>`, not the empty
 * string); absent, they stay `undefined`, so the core's default applies. `types` gives a prop
 * that takes a boolean or something else (`fitView`: true or a payload) its types.
 */
export function primitiveProps<Name extends string>(
    names: readonly Name[],
    booleans: readonly Name[] = [],
    types: Partial<Record<Name, PropType<unknown>>> = {},
): Record<Name, Prop<unknown> | null> {
    // a type-erased record (the primitive's public type comes from `FlowComponent`)
    return Object.fromEntries(
        names.map((name) => {
            const type = types[name];
            if (type !== undefined) return [name, { type, default: undefined }];
            return [
                name,
                booleans.includes(name)
                    ? { type: Boolean as PropType<unknown>, default: undefined }
                    : null,
            ];
        }),
    ) as Record<Name, Prop<unknown> | null>;
}

/**
 * Defines a primitive: a component named `Flow<name>` with `inheritAttrs: false` (it merges the
 * fallthrough attributes itself, under its structural style), the props named in `props`
 * (`booleans`: those that take a bare attribute as `true`) and the events named in `emits`.
 */
export function definePrimitive<
    Props extends object,
    Slots extends object,
    Emits extends ObjectEmitsOptions = NoEmits,
>(
    name: string,
    props: readonly (keyof Props & string)[],
    setup: (props: Props, context: PrimitiveContext<Slots>) => () => VNodeChild,
    options: {
        booleans?: readonly (keyof Props & string)[];
        types?: Partial<Record<keyof Props & string, PropType<unknown>>>;
        emits?: readonly (keyof Emits & string)[];
    } = {},
): FlowComponent<Props, Slots, Emits> {
    return defineComponent({
        name: `Flow${name}`,
        inheritAttrs: false,
        props: primitiveProps(props, options.booleans, options.types),
        emits: [...(options.emits ?? [])],
        setup(componentProps, { attrs, slots, emit }) {
            return setup(componentProps as unknown as Props, {
                attrs,
                slots: slots as PrimitiveContext<Slots>["slots"],
                emit: emit as PrimitiveContext<Slots>["emit"],
            });
        },
    }) as unknown as FlowComponent<Props, Slots, Emits>;
}

/**
 * A number prop that also takes its attribute's text (`duration="300"`), as Angular's inputs do:
 * a numeric string is its number, anything else is left for the engine to judge.
 */
export function numberProp(value: unknown): unknown {
    if (typeof value !== "string" || value.trim() === "") return value;
    const number = Number(value);
    return Number.isNaN(number) ? value : number;
}

/** The prop type of {@link numberProp}'s props. */
export const NUMBER_PROP = [Number, String] as PropType<unknown>;
