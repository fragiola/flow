<!-- `Field.Root`: the column (label, then the row), and the id its label and control share. -->
<script lang="ts">
    import type { HTMLAttributes } from "svelte/elements";
    import { field } from "#/components/families/field";
    import { cn } from "#/lib/cn";
    import { setFieldControlId } from "./context";

    let {
        class: className,
        children,
        ...rest
    }: HTMLAttributes<HTMLDivElement> & { class?: string } = $props();

    const uid = $props.id();
    setFieldControlId(`field-${uid}`);
</script>

<div data-slot="field-root" {...rest} class={cn(field.root(), className)}>{@render children?.()}</div>
