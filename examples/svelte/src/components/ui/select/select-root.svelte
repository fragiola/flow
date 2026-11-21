<!--
    `Select.Root`: a native `<select>` inside the field's box (`field.row`, the trigger's classes of
    React's Select), the chevron after it. Inside `Field.Root` it takes the field's control id, so
    its label names it. `bind:value` is the value.
-->
<script lang="ts">
    import { ChevronDownIcon } from "@lucide/svelte";
    import type { HTMLSelectAttributes } from "svelte/elements";
    import { field } from "#/components/families/field";
    import { fieldControlId } from "#/components/ui/field/context";
    import { cn } from "#/lib/cn";

    let {
        value = $bindable(),
        class: className,
        children,
        ...rest
    }: HTMLSelectAttributes & { class?: string } = $props();

    const id = fieldControlId();
</script>

<div
    data-slot="select-trigger"
    class={cn(field.row(), "relative flex-row items-center justify-between", className)}
>
    <select
        data-slot="select-value"
        {id}
        {...rest}
        bind:value
        class="w-full cursor-pointer appearance-none bg-transparent px-3 py-2 pe-9 text-sm text-palette-accent/85 outline-none"
    >
        {@render children?.()}
    </select>
    <ChevronDownIcon
        aria-hidden="true"
        class="pointer-events-none absolute end-3 size-icon text-palette-accent/85"
    />
</div>
