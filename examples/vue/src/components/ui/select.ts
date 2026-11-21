// Vue port of the Fragiola UI select (examples/react/src/components/ui/select.tsx) over Reka UI's
// Select: the same parts and classes, every one from a family (field + popup + menu). `v-model` on
// `Select.Root` is the value (Base UI's `value`/`onValueChange`). Base UI and Reka UI name the
// popup's state and its room differently: the content adds Base UI's `data-open` and its
// `--available-height` / `--transform-origin`, so the classes are the React ones (both mark the
// highlighted item `data-highlighted`).

import { CheckIcon, ChevronDownIcon } from "@lucide/vue";
import {
    SelectContent as SelectContentPrimitive,
    SelectItemIndicator,
    SelectItem as SelectItemPrimitive,
    SelectItemText,
    SelectPortal,
    SelectRoot as SelectRootPrimitive,
    SelectTrigger as SelectTriggerPrimitive,
    SelectValue as SelectValuePrimitive,
    SelectViewport,
} from "reka-ui";
import { defineComponent, h } from "vue";
import { field } from "#/components/families/field";
import { menu } from "#/components/families/menu";
import { popup } from "#/components/families/popup";
import { useFieldControlId } from "#/components/ui/field";
import { cn } from "#/lib/cn";

const SelectRoot = defineComponent({
    name: "SelectRoot",
    inheritAttrs: false,
    props: {
        modelValue: { type: String, default: undefined },
    },
    emits: { "update:modelValue": (_value: string) => true },
    setup(props, { attrs, slots, emit }) {
        return () =>
            h(
                SelectRootPrimitive,
                {
                    ...attrs,
                    modelValue: props.modelValue,
                    "onUpdate:modelValue": (value: unknown) =>
                        emit("update:modelValue", String(value)),
                },
                slots,
            );
    },
});

const SelectValue = defineComponent({
    name: "SelectValue",
    inheritAttrs: false,
    setup(_, { attrs, slots }) {
        return () =>
            h(
                SelectValuePrimitive,
                {
                    "data-slot": "select-value",
                    ...attrs,
                    class: cn(
                        "text-sm text-palette-accent/85",
                        attrs.class as string,
                    ),
                },
                slots,
            );
    },
});

const SelectTrigger = defineComponent({
    name: "SelectTrigger",
    inheritAttrs: false,
    setup(_, { attrs, slots }) {
        // inside `Field.Root`, the field's control: its label names the trigger
        const id = useFieldControlId();
        return () =>
            h(
                SelectTriggerPrimitive,
                {
                    "data-slot": "select-trigger",
                    id,
                    ...attrs,
                    // the trigger IS a field row; the layout is its own
                    class: cn(
                        field.row(),
                        "flex-row items-center justify-between px-3 py-2",
                        attrs.class as string,
                    ),
                },
                () => [
                    slots.default?.(),
                    h(ChevronDownIcon, {
                        class: "size-icon text-palette-accent/85",
                    }),
                ],
            );
    },
});

const SelectContent = defineComponent({
    name: "SelectContent",
    inheritAttrs: false,
    setup(_, { attrs, slots }) {
        return () =>
            h(SelectPortal, null, () =>
                h(
                    SelectContentPrimitive,
                    {
                        "data-slot": "select-content",
                        position: "popper",
                        side: "bottom",
                        align: "start",
                        sideOffset: 4,
                        "data-open": "",
                        ...attrs,
                        style: [
                            {
                                "--available-height":
                                    "var(--reka-select-content-available-height)",
                                "--transform-origin":
                                    "var(--reka-select-content-transform-origin)",
                            },
                            attrs.style,
                        ],
                        class: cn(
                            popup.content("isolate z-50 outline-none"),
                            attrs.class as string,
                        ),
                    },
                    () => h(SelectViewport, null, slots),
                ),
            );
    },
});

const SelectItem = defineComponent({
    name: "SelectItem",
    inheritAttrs: false,
    props: {
        value: { type: String, required: true },
    },
    setup(props, { attrs, slots }) {
        return () =>
            h(
                SelectItemPrimitive,
                {
                    "data-slot": "select-item",
                    ...attrs,
                    value: props.value,
                    class: cn(menu.selectableItem(), attrs.class as string),
                },
                () => [
                    h(
                        SelectItemIndicator,
                        {
                            class: menu.itemIndicator(),
                            "data-slot": "select-item-indicator",
                        },
                        () => h(CheckIcon),
                    ),
                    h(SelectItemText, null, slots),
                ],
            );
    },
});

export const Select = {
    Root: SelectRoot,
    Trigger: SelectTrigger,
    Value: SelectValue,
    Content: SelectContent,
    Item: SelectItem,
};
