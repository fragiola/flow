<!-- `Field.Body`: the family's `body` slot. -->
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

<div data-slot="field-body" {...rest} class={cn(field.body(), className)}>{@render children?.()}</div>
