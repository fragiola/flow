import { Component, computed } from "@angular/core";
import {
    injectNodeConnections,
    injectNodeId,
    injectNodesData,
} from "@fragiola/flow-angular";
import type { Types } from "./index";
import { styles } from "./styles";

// The sum of the nodes connected into this one: its connections, then their data.
@Component({
    selector: "example-connected-data-sum",
    host: { class: "contents" },
    template: `
        <div [class]="styles.sum">
            <span [class]="styles.title">Sum</span>
            <output data-testid="sum-total" [class]="styles.total">{{ result().total }}</output>
            <span data-testid="sum-sources" [class]="styles.sources">{{ result().sources }}</span>
        </div>
    `,
})
export class SumBody {
    protected readonly styles = styles;
    private readonly nodeId = injectNodeId();
    private readonly connections = injectNodeConnections({ type: "target" });
    private readonly inputs = injectNodesData<Types>(() =>
        this.connections().map((connection) => connection.source),
    );
    protected readonly result = computed(() => {
        let total = 0;
        const labels: string[] = [];
        for (const input of this.inputs()) {
            if (input.type !== "number") continue;
            total += input.data.value;
            labels.push(input.data.label);
        }
        return {
            total,
            sources:
                labels.length > 0
                    ? `of ${labels.join(" + ")}`
                    : `nothing into ${this.nodeId()}`,
        };
    });
}
