import { Component, input, output } from "@angular/core";
import { LucidePlus } from "@lucide/angular";
import { styles } from "./styles";
import type { PlaceholderData } from "./tree";

/** The "+" under a topic: adds a child to it (`add`, given the topic's id). */
@Component({
    selector: "button[exampleAddButton]",
    imports: [LucidePlus],
    host: {
        type: "button",
        "[attr.aria-label]": "'Add a child to ' + data().parentLabel",
        "[class]": "styles.add",
        "(click)": "add.emit(data().parentId)",
    },
    template: `<svg lucidePlus aria-hidden="true" [class]="styles.icon"></svg>`,
})
export class AddButton {
    readonly data = input.required<PlaceholderData>();
    readonly add = output<string>();
    protected readonly styles = styles;
}
