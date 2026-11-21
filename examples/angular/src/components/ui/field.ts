// Angular port of the Fragiola UI field (examples/react/src/components/ui/field.tsx): the same
// parts, classes and palette roles from the `field` family, as directives on your own elements.
// Base UI's Field wires the label to the control in React; here `kitFieldRoot` gives its parts one
// id, the label's `for` and the control's `id` (`#/components/atoms/fields`,
// `#/components/ui/select`), so a control is named by its label.
//
//     <div kitFieldRoot>
//         <label kitFieldLabel>Name</label>
//         <div kitFieldRow><div kitFieldBody><input kitInput [value]="name" /></div></div>
//     </div>

import { computed, Directive, inject, input } from "@angular/core";
import { field } from "#/components/families/field";
import { cn } from "#/lib/cn";

let fields = 0;

/** The column (label, then the row), and the id its label and control share. */
@Directive({
    selector: "[kitFieldRoot]",
    host: { "data-slot": "field-root", "[class]": "classes()" },
})
export class FieldRoot {
    readonly class = input<string>();
    /** the id of the field's control, its label's `for` */
    readonly controlId = `field-${++fields}`;
    protected readonly classes = computed(() => cn(field.root(), this.class()));
}

/** The id the control of the enclosing `kitFieldRoot` takes, if any. */
export function injectFieldControlId(): string | undefined {
    return inject(FieldRoot, { optional: true })?.controlId;
}

/** Text.Label's typography, then the family's palette and state; names the control. */
@Directive({
    selector: "label[kitFieldLabel]",
    host: {
        "data-slot": "field-label",
        "[attr.for]": "control",
        "[class]": "classes()",
    },
})
export class FieldLabel {
    readonly class = input<string>();
    protected readonly control = injectFieldControlId();
    protected readonly classes = computed(() =>
        cn(
            "text-palette-contrast text-sm font-medium block",
            field.label(),
            this.class(),
        ),
    );
}

/** The family's `row` slot: the box. */
@Directive({
    selector: "[kitFieldRow]",
    host: { "data-slot": "field-row", "[class]": "classes()" },
})
export class FieldRow {
    readonly class = input<string>();
    protected readonly classes = computed(() => cn(field.row(), this.class()));
}

/** The family's `body` slot. */
@Directive({
    selector: "[kitFieldBody]",
    host: { "data-slot": "field-body", "[class]": "classes()" },
})
export class FieldBody {
    readonly class = input<string>();
    protected readonly classes = computed(() => cn(field.body(), this.class()));
}

/** The family's `inset` slot. */
@Directive({
    selector: "[kitFieldInset]",
    host: { "data-slot": "field-inset", "[class]": "classes()" },
})
export class FieldInset {
    readonly class = input<string>();
    protected readonly classes = computed(() =>
        cn(field.inset(), this.class()),
    );
}

/** Every part of a field, for a component's `imports`. */
export const FIELD = [
    FieldRoot,
    FieldLabel,
    FieldRow,
    FieldBody,
    FieldInset,
] as const;
