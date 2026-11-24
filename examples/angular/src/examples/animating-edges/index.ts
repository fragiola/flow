import { Component, DestroyRef, inject, signal } from "@angular/core";
import {
    createFlowModel,
    FLOW,
    type FlowJson,
    type FlowTypes,
} from "@fragiola/flow-angular";
import { drag } from "@fragiola/flow-angular/drag";
import { keyboard } from "@fragiola/flow-angular/keyboard";
import { selection } from "@fragiola/flow-angular/selection";
import { AnimatedEdge } from "./animated-edge";
import { CounterBody } from "./counter-body";
import {
    type Motion,
    onReducedMotionChange,
    prefersReducedMotion,
} from "./motion";
import { SenderBody } from "./sender-body";
import { styles } from "./styles";

// The package animates nothing: an edge moves by what the app puts in it. A dot travels along the
// first edge (an SVG `<animateMotion>` whose `path` is the edge's own, `flowEdge`'s
// `state().path`, so it follows the edge while a node is dragged), dashes flow along the second
// (an `<animate>` of the path's `stroke-dashoffset`, inside the app's `flowEdgePath`), and the
// third pulses once when a value passes: "Send a value" marks it `data-pulsing`, its style runs
// one pulse, and `animationend` clears the mark and hands the value over. Under
// `prefers-reduced-motion` (read with `matchMedia`, followed live) neither the dot nor the dashes
// move, and those edges say so (`data-reduced-motion`).

export interface Types extends FlowTypes {
    readonly nodes: {
        step: { label: string };
        sender: { label: string };
        counter: { label: string };
    };
    readonly edges: { animated: { motion: Motion } };
}

export const features = [selection(), drag(), keyboard()] as const;

const animated = (source: string, target: string, motion: Motion) => ({
    id: `${source}-${target}`,
    source,
    target,
    type: "animated" as const,
    data: { motion },
});

const json: FlowJson<Types> = {
    version: 1,
    nodes: [
        {
            id: "ingest",
            type: "step",
            position: { x: 0, y: 0 },
            data: { label: "Ingest" },
        },
        {
            id: "process",
            type: "step",
            position: { x: 300, y: 0 },
            data: { label: "Process" },
        },
        {
            id: "store",
            type: "step",
            position: { x: 600, y: 0 },
            data: { label: "Store" },
        },
        {
            id: "sender",
            type: "sender",
            position: { x: 120, y: 200 },
            data: { label: "Sender" },
        },
        {
            id: "counter",
            type: "counter",
            position: { x: 480, y: 200 },
            data: { label: "Counter" },
        },
    ],
    edges: [
        animated("ingest", "process", "travel"),
        animated("process", "store", "dash"),
        animated("sender", "counter", "pulse"),
    ],
};

export const LABELS: Record<string, string> = Object.fromEntries(
    json.nodes.map((node) => [node.id, node.data.label]),
);

@Component({
    selector: "example-animating-edges",
    imports: [FLOW, AnimatedEdge, CounterBody, SenderBody],
    host: { class: "contents" },
    template: `
        <div
            flowRoot
            [model]="model"
            [fitView]="{ padding: 0.15, maxZoom: 1 }"
            role="group"
            aria-label="Animating edges"
            [class]="styles.root"
        >
            <svg flowBackground variant="dots" [size]="2" [class]="styles.dots"></svg>
            <svg flowBackground variant="lines" [class]="styles.lines"></svg>
            <svg flowBackground variant="cross" [class]="styles.cross"></svg>
            <div flowViewport>
                <div flowEdges>
                    <ng-template [flowEdgesItem]="model" let-edge>
                        <svg:g
                            [flowEdge]="edge"
                            exampleAnimatedEdge
                            [reduced]="reduced()"
                            [sending]="sending()"
                            (arrive)="arrive()"
                            role="group"
                            aria-roledescription="edge"
                            [class]="styles.edgeGroup"
                        ></svg:g>
                    </ng-template>
                </div>
                <div flowNodes>
                    <ng-template [flowNodesItem]="model" let-node>
                        <div
                            [flowNode]="node"
                            role="group"
                            aria-roledescription="node"
                            [attr.aria-label]="node.data.label"
                            [class]="styles.node"
                        >
                            <div flowHandle type="target" side="left" [class]="styles.handle"></div>
                            @if (node.type === "sender") {
                                <div
                                    exampleSenderBody
                                    [label]="node.data.label"
                                    [sending]="sending()"
                                    (sendValue)="send()"
                                    (dropValue)="drop()"
                                    [class]="styles.body"
                                ></div>
                            } @else if (node.type === "counter") {
                                <div
                                    exampleCounterBody
                                    [label]="node.data.label"
                                    [received]="received()"
                                    [class]="styles.body"
                                ></div>
                            } @else {
                                {{ node.data.label }}
                            }
                            <div flowHandle type="source" side="right" [class]="styles.handle"></div>
                        </div>
                    </ng-template>
                </div>
            </div>
        </div>
    `,
})
export default class AnimatingEdges {
    protected readonly styles = styles;
    protected readonly model = createFlowModel<Types, typeof features>(json, {
        features,
    });
    /** whether the user asked for reduced motion, followed live */
    protected readonly reduced = signal(prefersReducedMotion());
    // The values passing from the sender to the counter: app state, outside the flow's document.
    /** a value is on its way: the pulse is running */
    protected readonly sending = signal(false);
    /** how many values the counter has received */
    protected readonly received = signal(0);

    constructor() {
        const stop = onReducedMotionChange(() =>
            this.reduced.set(prefersReducedMotion()),
        );
        inject(DestroyRef).onDestroy(stop);
    }

    protected send(): void {
        this.sending.set(true);
    }

    /** the pulse ended: the value arrives */
    protected arrive(): void {
        this.sending.set(false);
        this.received.update((count) => count + 1);
    }

    /** the pulse's edge is gone: the value is dropped */
    protected drop(): void {
        this.sending.set(false);
    }
}
