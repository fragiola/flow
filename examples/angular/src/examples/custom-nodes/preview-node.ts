import { Component, computed, input } from "@angular/core";
import {
    FlowHandleDirective,
    injectEdges,
    injectNodes,
} from "@fragiola/flow-angular";
import type { Node, Types } from "./index";
import { styles } from "./styles";

// The preview: it reads the nodes wired into its two target handles.
@Component({
    selector: "example-custom-nodes-preview",
    imports: [FlowHandleDirective],
    host: { class: "contents" },
    template: `
        <span [class]="styles.caption">{{ node().data.label }}</span>
        <div [class]="styles.stage">
            @if (fill(); as fill) {
                <div
                    role="img"
                    [attr.aria-label]="'A ' + side() + ' pixel swatch of ' + fill"
                    [class]="styles.swatch"
                    [style.background]="fill"
                    [style.width.px]="side()"
                    [style.height.px]="side()"
                ></div>
            } @else {
                <span [class]="styles.empty">Connect a colour</span>
            }
        </div>
        <div flowHandle type="target" side="left" handleId="colour" [class]="styles.handle" style="top: 35%"></div>
        <div flowHandle type="target" side="left" handleId="size" [class]="styles.handle" style="top: 75%"></div>
    `,
})
export class PreviewNode {
    readonly node = input.required<Extract<Node, { type: "preview" }>>();
    protected readonly styles = styles;
    private readonly edges = injectEdges<Types>();
    private readonly nodes = injectNodes<Types>();

    /** The value wired into one of the preview's handles: the source node's data, if any. */
    private inputOf(handleId: string): Node | undefined {
        const edge = this.edges().find(
            (e) => e.target === this.node().id && e.targetHandle === handleId,
        );
        return this.nodes().find((n) => n.id === edge?.source);
    }

    protected readonly fill = computed(() => {
        const colour = this.inputOf("colour");
        return colour?.type === "colour" ? colour.data.colour : undefined;
    });
    protected readonly side = computed(() => {
        const size = this.inputOf("size");
        return size?.type === "number" ? size.data.value : 32;
    });
}
