// Angular port of the Fragiola UI select (examples/react/src/components/ui/select.tsx) as a native
// `<select>`, as examples/svelte's: its box wears React's trigger classes (`field.row`, the chevron
// after the value), its options are the platform's. No headless select primitive is added for one
// inspector field (React's is Base UI, Vue's Reka UI); the native element is labelled,
// keyboard-operable and a `combobox` to assistive technology as they are. Inside `kitFieldRoot` it
// takes the field's control id, so its label names it. `[(value)]` is its value.
//
//     <kit-select [value]="kind" (valueChange)="setKind($event)">
//         <option kitSelectItem value="webhook">Webhook</option>
//     </kit-select>

import { Component, computed, Directive, input, model } from "@angular/core";
import { LucideChevronDown } from "@lucide/angular";
import { field } from "#/components/families/field";
import { injectFieldControlId } from "#/components/ui/field";
import { cn } from "#/lib/cn";

/** The select: a native `<select>` inside the field's box, the chevron after it. */
@Component({
    selector: "kit-select",
    imports: [LucideChevronDown],
    host: { "data-slot": "select-trigger", "[class]": "classes()" },
    template: `
        <select
            data-slot="select-value"
            [attr.id]="id"
            [value]="value()"
            (change)="pick($event)"
            class="field-control w-full cursor-pointer appearance-none bg-transparent px-3 py-2 pe-9 text-sm text-palette-accent/85 outline-none"
        >
            <ng-content />
        </select>
        <svg
            lucideChevronDown
            aria-hidden="true"
            class="pointer-events-none absolute end-3 size-icon text-palette-accent/85"
        ></svg>
    `,
})
export class Select {
    /** the selected option's value */
    readonly value = model<string>("");
    readonly class = input<string>();
    protected readonly id = injectFieldControlId();
    protected readonly classes = computed(() =>
        cn(
            field.row(),
            "relative flex-row items-center justify-between",
            this.class(),
        ),
    );

    protected pick(event: Event): void {
        this.value.set((event.target as HTMLSelectElement).value);
    }
}

/** One option of a select (`value`, its label as content). */
@Directive({
    selector: "option[kitSelectItem]",
    host: { "data-slot": "select-item" },
})
export class SelectItem {}

/** Both parts of a select, for a component's `imports`. */
export const SELECT = [Select, SelectItem] as const;
