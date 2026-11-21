// Angular port of the Fragiola UI bare input (examples/react/src/components/atoms/fields/input.tsx),
// as a directive on your own `<input>`: no border, background or focus ring of its own (the
// field's row draws them), the `field` family's control classes. Inside `kitFieldRoot` it takes the
// field's control id, so its label names it.
//
//     <input kitInput [value]="title" (input)="rename($event)" />

import { computed, Directive, input } from "@angular/core";
import { field } from "#/components/families/field";
import { injectFieldControlId } from "#/components/ui/field";
import { cn } from "#/lib/cn";

/** A bare text control (React's `Input`). */
@Directive({
    selector: "input[kitInput]",
    host: {
        "data-slot": "input",
        "[attr.id]": "id",
        "[class]": "classes()",
    },
})
export class Input {
    readonly class = input<string>();
    protected readonly id = injectFieldControlId();
    protected readonly classes = computed(() =>
        cn(field.control(), this.class()),
    );
}
