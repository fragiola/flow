<!-- `Field.Label`: Text.Label's typography, then the family's palette and state; names the control. -->
<script lang="ts">
    import type { HTMLLabelAttributes } from "svelte/elements";
    import { field } from "#/components/families/field";
    import { cn } from "#/lib/cn";
    import { fieldControlId } from "./context";

    let {
        class: className,
        children,
        ...rest
    }: HTMLLabelAttributes & { class?: string } = $props();

    const control = fieldControlId();
</script>

<label
    data-slot="field-label"
    for={control}
    {...rest}
    class={cn("text-palette-contrast text-sm font-medium block", field.label(), className)}
>
    {@render children?.()}
</label>
