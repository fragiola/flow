// Vue port of the Fragiola UI field (examples/react/src/components/ui/field.tsx): the same parts,
// classes and palette roles from the `field` family. Base UI's Field wires the label to the control
// in React; here `Field.Root` gives its parts one id (`useId`), the label's `for` and the control's
// `id` (`#/components/atoms/fields`), so a control is named by its label.

import {
    defineComponent,
    h,
    type InjectionKey,
    inject,
    provide,
    useId,
} from "vue";
import { field } from "#/components/families/field";
import { cn } from "#/lib/cn";

/** The id of the control of the field it is inside (`Field.Root`). */
export const FIELD_CONTROL_ID: InjectionKey<string> = Symbol("field-control");

/** The id the control of the enclosing `Field.Root` takes, if any. */
export function useFieldControlId(): string | undefined {
    return inject(FIELD_CONTROL_ID, undefined);
}

function part(name: string, tag: string, classes: () => string) {
    return defineComponent({
        name,
        inheritAttrs: false,
        setup(_, { attrs, slots }) {
            return () =>
                h(
                    tag,
                    {
                        "data-slot": `field-${name.replace(/^Field/, "").toLowerCase()}`,
                        ...attrs,
                        class: cn(classes(), attrs.class as string),
                    },
                    slots.default?.(),
                );
        },
    });
}

const FieldRoot = defineComponent({
    name: "FieldRoot",
    inheritAttrs: false,
    setup(_, { attrs, slots }) {
        provide(FIELD_CONTROL_ID, `field-${useId()}`);
        return () =>
            h(
                "div",
                {
                    "data-slot": "field-root",
                    ...attrs,
                    class: cn(field.root(), attrs.class as string),
                },
                slots.default?.(),
            );
    },
});

const FieldLabel = defineComponent({
    name: "FieldLabel",
    inheritAttrs: false,
    setup(_, { attrs, slots }) {
        const control = useFieldControlId();
        return () =>
            h(
                "label",
                {
                    "data-slot": "field-label",
                    for: control,
                    ...attrs,
                    // Text.Label's typography, then the family's palette and state
                    class: cn(
                        "text-palette-contrast text-sm font-medium block",
                        field.label(),
                        attrs.class as string,
                    ),
                },
                slots.default?.(),
            );
    },
});

export const Field = {
    Root: FieldRoot,
    Label: FieldLabel,
    Row: part("FieldRow", "div", () => field.row()),
    Body: part("FieldBody", "div", () => field.body()),
    Inset: part("FieldInset", "div", () => field.inset()),
};
