// Angular port of the Fragiola UI badge (examples/react/src/components/atoms/badge/index.tsx): the
// same element, variants, classes and palette roles, as a directive on your own `<span>`. Tone
// arrives as a palette class from outside (`class="palette-danger"`), as in React.
//
//     <span kitBadge variant="outline" [class]="styles.badge">Read only</span>

import { computed, Directive, input } from "@angular/core";
import { tv, type VariantProps } from "tailwind-variants";
import { cn } from "#/lib/cn";

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

/** A small status indicator: `variant` is its fill (soft, solid, outline), never a colour. */
@Directive({
    selector: "span[kitBadge]",
    host: { "data-slot": "badge", "[class]": "classes()" },
})
export class Badge {
    readonly variant = input<BadgeVariants["variant"]>();
    readonly class = input<string>();
    protected readonly classes = computed(() =>
        cn(badge({ variant: this.variant() }), this.class()),
    );
}
