import { Component, computed } from "@angular/core";
import { injectSelection } from "@fragiola/flow-angular";
import type { Types } from "./index";
import { styles } from "./styles";

/** What is selected, read with `injectSelection()` inside the root. */
@Component({
    selector: "example-selection-status",
    host: { class: "contents" },
    template: `<div role="status" data-testid="selection" [class]="styles.status">{{ text() }}</div>`,
})
export class SelectionStatus {
    protected readonly styles = styles;
    private readonly selected = injectSelection<Types>();
    protected readonly text = computed(() => {
        const { nodes, edges } = this.selected();
        const names = nodes.map((node) => node.data.label);
        return nodes.length === 0 && edges.length === 0
            ? "Nothing selected"
            : `${nodes.length} nodes, ${edges.length} edges selected${names.length > 0 ? `: ${names.join(", ")}` : ""}`;
    });
}
