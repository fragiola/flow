<!--
    Svelte port of the Fragiola UI bare input (examples/react/src/components/atoms/fields/input.tsx):
    no border, background or focus ring of its own (the field's row draws them), the `field`
    family's control classes. Inside `Field.Root` it takes the field's control id, so its label
    names it. `bind:value` is its text.
-->
<script lang="ts">
    import type { HTMLInputAttributes } from "svelte/elements";
    import { field } from "#/components/families/field";
    import { fieldControlId } from "#/components/ui/field/context";
    import { cn } from "#/lib/cn";

    let {
        value = $bindable(),
        class: className,
        ...rest
    }: HTMLInputAttributes & { class?: string } = $props();

    const id = fieldControlId();
</script>

<input data-slot="input" {id} {...rest} bind:value class={cn(field.control(), className)} />
