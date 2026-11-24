import { Component, computed, inject } from "@angular/core";
import {
    FLOW,
    FlowNodeDirective,
    injectViewport,
} from "@fragiola/flow-angular";
import { Badge } from "#/components/atoms/badge";
import { atLeast, detailOf } from "./detail";
import type { Types } from "./index";
import { styles } from "./styles";

/**
 * A service: its name; from medium detail its kind and health; at high its owner and figures (on
 * the node's own element). Its level is a `computed` over the viewport: a pan re-checks it, and
 * the view updates only when the level changes.
 */
@Component({
    selector: "[exampleServiceNode]",
    imports: [FLOW, Badge],
    host: { "[attr.data-detail]": "detail()" },
    template: `
        @let data = node.flowNode().data;
        <div flowHandle type="target" side="left" [class]="styles.handle"></div>
        <span [class]="styles.title">{{ data.label }}</span>
        @if (atLeast(detail(), "medium")) {
            <span [class]="styles.summary">
                <span>{{ data.kind }}</span>
                <span kitBadge variant="soft" [class]="styles.health(data.health)">
                    {{ data.health }}
                </span>
            </span>
        }
        @if (atLeast(detail(), "high")) {
            <dl [class]="styles.facts">
                <dt [class]="styles.term">Owner</dt>
                <dd>{{ data.owner }}</dd>
                <dt [class]="styles.term">Load</dt>
                <dd>{{ data.requests }}</dd>
                <dt [class]="styles.term">p95</dt>
                <dd>{{ data.latency }}</dd>
            </dl>
        }
        <div flowHandle type="source" side="right" [class]="styles.handle"></div>
    `,
})
export class ServiceNode {
    protected readonly styles = styles;
    protected readonly atLeast = atLeast;
    protected readonly node =
        inject<FlowNodeDirective<Types>>(FlowNodeDirective);
    private readonly viewport = injectViewport();
    /** the detail level at the current zoom; changes only when the level does */
    protected readonly detail = computed(() => detailOf(this.viewport().zoom));
}
