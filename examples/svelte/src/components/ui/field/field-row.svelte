<!-- `Field.Row`: the family's `row` slot. -->
<script lang="ts">
    import type { HTMLAttributes } from "svelte/elements";
    import { field } from "#/components/families/field";
    import { cn } from "#/lib/cn";

    let {
        class: className,
        children,
        ...rest
    }: HTMLAttributes<HTMLDivElement> & { class?: string } = $props();
</script>

<div data-slot="field-row" {...rest} class={cn(field.row(), className)}>{@render children?.()}</div>
