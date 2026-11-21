<!--
    Svelte port of the Fragiola UI badge (examples/react/src/components/atoms/badge/index.tsx): the
    same element, variants, classes and palette roles. Tone arrives as a palette class from outside
    (`class="palette-danger"`), as in React.
-->
<script module lang="ts">
    import { tv, type VariantProps } from "tailwind-variants";

    export const badge = tv({
        base: `
        inline-flex items-center rounded-pill border px-2.5 py-0.5
        text-xs font-medium transition-colors
        [&_svg:not([class*='size-'])]:size-icon-xs
    `,
        variants: {
            variant: {
                soft: "bg-palette-soft text-palette-accent border-transparent",
                solid: "bg-palette-base text-palette-contrast border-transparent",
                outline: "bg-transparent text-palette-accent border-palette-line",
            },
        },
        defaultVariants: {
            variant: "soft",
        },
    });

    export type BadgeVariants = VariantProps<typeof badge>;
</script>

<script lang="ts">
    import type { HTMLAttributes } from "svelte/elements";
    import { cn } from "#/lib/cn";

    let {
        variant,
        class: className,
        children,
        ...rest
    }: HTMLAttributes<HTMLSpanElement> & BadgeVariants & { class?: string } = $props();
</script>

<span data-slot="badge" {...rest} class={cn(badge({ variant }), className)}>{@render children?.()}</span>
