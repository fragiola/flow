import { Component, computed, inject } from "@angular/core";
import {
    FLOW,
    FlowEdgeDirective,
    injectFlowStore,
} from "@fragiola/flow-angular";
import type { features, Types } from "./index";
import { styles } from "./styles";
import { isPlaceholder, topicData } from "./tree";

/**
 * An edge, named by its topics: "Marketing to Campaign", or "Marketing to its add button" (on the
 * edge's own group). The labels are read from the document (an added topic's too).
 */
@Component({
    selector: "[exampleTreeEdge]",
    imports: [FLOW],
    host: { "[attr.aria-label]": "label()" },
    template: `
        <svg:path
            flowEdgePath
            [class]="placeholder() ? styles.placeholderEdge : styles.edge"
        />
    `,
})
export class TreeEdge {
    protected readonly styles = styles;
    private readonly edge = inject<FlowEdgeDirective<Types>>(FlowEdgeDirective);
    protected readonly placeholder = computed(() =>
        isPlaceholder(this.edge.flowEdge().target),
    );
    protected readonly label = injectFlowStore<string, Types, typeof features>(
        ({ model }) => {
            /** A topic's label; its id for a placeholder (or a node not found). */
            const labelOf = (id: string) => {
                const node = model.get("node-by", { id });
                return node && !isPlaceholder(id) ? topicData(node).label : id;
            };
            const { source, target } = this.edge.flowEdge();
            return isPlaceholder(target)
                ? `${labelOf(source)} to its add button`
                : `${labelOf(source)} to ${labelOf(target)}`;
        },
    );
}
