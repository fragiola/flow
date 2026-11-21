// Vue port of the Fragiola UI bare input (examples/react/src/components/atoms/fields/input.tsx): no
// border, background or focus ring of its own (the field's row draws them), the `field` family's
// control classes. Inside `Field.Root` it takes the field's control id, so its label names it.
// `v-model` is its text.

import { defineComponent, h } from "vue";
import { field } from "#/components/families/field";
import { useFieldControlId } from "#/components/ui/field";
import { cn } from "#/lib/cn";

export const Input = defineComponent({
    name: "FieldInput",
    inheritAttrs: false,
    props: {
        modelValue: { type: [String, Number], default: undefined },
    },
    emits: { "update:modelValue": (_value: string) => true },
    setup(props, { attrs, emit }) {
        const id = useFieldControlId();
        return () =>
            h("input", {
                "data-slot": "input",
                id,
                ...attrs,
                value: props.modelValue,
                onInput: (event: Event) =>
                    emit(
                        "update:modelValue",
                        (event.target as HTMLInputElement).value,
                    ),
                class: cn(field.control(), attrs.class as string),
            });
    },
});
