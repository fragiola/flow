<!-- `Field.Inset`: the family's `inset` slot. -->
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

<div data-slot="field-inset" {...rest} class={cn(field.inset(), className)}>{@render children?.()}</div>
