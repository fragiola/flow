import { Component, DestroyRef, inject, signal } from "@angular/core";
import {
    createFlowModel,
    createFlowRef,
    FLOW,
    type FlowEdgeInput,
    type FlowNodeInput,
    type FlowTypes,
} from "@fragiola/flow-angular";
import { drag } from "@fragiola/flow-angular/drag";
import { selection } from "@fragiola/flow-angular/selection";
import { Handles } from "./handles";
import {
    DIRECTIONS,
    type Direction,
    layoutPositions,
    type Point,
} from "./layout";
import { styles } from "./styles";
import { tween } from "./tween";

// A tree laid out by dagre (`layout.ts`): the nodes declare their size, dagre ranks them from the
// root and places them, and the flow opens laid out (the positions are computed before the first
// render) and fitted to the view. "Direction" lays it out again top to bottom or left to right:
// each node's handles move to the sides the tree now grows by (handles.ts, given the direction as
// an input and remounted per direction, a one-item `@for` tracked by it, as the engine reads a
// handle's side when it registers), and the nodes glide to their new places: one transient
// `batch` of `node.move` per animation frame, eased (`tween.ts`), then one batch that is not
// transient with the exact places (one step for a history or a save), then `fit-view` animated.
// The root carries `data-direction`, and `data-animating` while the nodes move; leaving stops the
// animation's frames (`DestroyRef`).

export interface Types extends FlowTypes {
    readonly nodes: { step: { label: string } };
}

export const features = [selection(), drag()] as const;

/** Every node's declared box, in flow units: what dagre lays out. */
const WIDTH = 150;
const HEIGHT = 44;

/** How long the nodes take to reach their new places, in milliseconds. */
const DURATION = 350;

/** How the view fits the tree: some room around it, never zoomed in past 1. */
const FIT = { padding: 0.15, maxZoom: 1 };

/** The tree: a product study, from the idea to the launch (Findings and Roadmap join two branches). */
const STEPS: readonly (readonly [id: string, label: string])[] = [
    ["idea", "Idea"],
    ["research", "Research"],
    ["design", "Design"],
    ["interviews", "Interviews"],
    ["survey", "Survey"],
    ["sketches", "Sketches"],
    ["prototype", "Prototype"],
    ["findings", "Findings"],
    ["usability", "Usability test"],
    ["roadmap", "Roadmap"],
    ["launch", "Launch"],
];

const LINKS: readonly (readonly [source: string, target: string])[] = [
    ["idea", "research"],
    ["idea", "design"],
    ["research", "interviews"],
    ["research", "survey"],
    ["design", "sketches"],
    ["design", "prototype"],
    ["interviews", "findings"],
    ["survey", "findings"],
    ["prototype", "usability"],
    ["findings", "roadmap"],
    ["usability", "roadmap"],
    ["roadmap", "launch"],
];

const LABELS: Record<string, string> = Object.fromEntries(STEPS);

const labelOf = (id: string) => LABELS[id] ?? id;

const edges: FlowEdgeInput<Types>[] = LINKS.map(([source, target]) => ({
    id: `${source}-${target}`,
    source,
    target,
}));

/** What the layout reads of a node: its id and declared size. */
const boxOf = (node: { id: string; width?: number; height?: number }) => ({
    id: node.id,
    width: node.width ?? WIDTH,
    height: node.height ?? HEIGHT,
});

const FIRST: Direction = "vertical";

// laid out before the first render: the flow opens arranged, with nothing to animate
const firstPlaces = layoutPositions(
    STEPS.map(([id]) => ({ id, width: WIDTH, height: HEIGHT })),
    edges,
    FIRST,
);

const nodes: FlowNodeInput<Types>[] = STEPS.map(([id, label]) => ({
    id,
    type: "step",
    position: firstPlaces.get(id) ?? { x: 0, y: 0 },
    width: WIDTH,
    height: HEIGHT,
    data: { label },
}));

const DIRECTION_NAMES: Record<Direction, string> = {
    vertical: "Vertical",
    horizontal: "Horizontal",
};

/** Calls `step` with the progress (0 to 1) on every animation frame for `duration` ms; returns a stop. */
function everyFrame(duration: number, step: (t: number) => void): () => void {
    const start = performance.now();
    let id = requestAnimationFrame(function onFrame(now) {
        const t = Math.min(1, (now - start) / duration);
        step(t);
        if (t < 1) id = requestAnimationFrame(onFrame);
    });
    return () => cancelAnimationFrame(id);
}

/** One `node.move` per node, for a `batch`. */
const movesTo = (positions: ReadonlyMap<string, Point>) =>
    [...positions].map(([nodeId, position]) => ({
        command: "node.move" as const,
        payload: { nodeId, position },
    }));

/** A node's place as it prints it, for the tests: "x, y", rounded. */
const placeOf = (position: Point) =>
    `${Math.round(position.x)}, ${Math.round(position.y)}`;

@Component({
    selector: "example-dagre-layout",
    imports: [FLOW, Handles],
    host: { class: "contents" },
    template: `
        <div
            flowRoot
            [model]="model"
            [fitView]="fit"
            [flowRef]="flow"
            role="group"
            aria-label="Dagre layout"
            [attr.data-direction]="direction()"
            [attr.data-animating]="animating() ? '' : null"
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
                            role="group"
                            aria-roledescription="edge"
                            [attr.aria-label]="label(edge.source) + ' to ' + label(edge.target)"
                            [class]="styles.edgeGroup"
                        >
                            <svg:path flowEdgePath [class]="styles.edge" />
                        </svg:g>
                    </ng-template>
                </div>
                <div flowNodes>
                    <ng-template [flowNodesItem]="model" let-node>
                        <div
                            [flowNode]="node"
                            role="group"
                            aria-roledescription="node"
                            [attr.aria-label]="node.data.label"
                            [attr.data-position]="placeOf(node.position)"
                            [class]="styles.node"
                        >
                            <example-dagre-handles [direction]="direction()" />
                            {{ node.data.label }}
                        </div>
                    </ng-template>
                </div>
            </div>
            <fieldset [class]="styles.panel">
                <legend [class]="styles.legend">Direction</legend>
                @for (option of directions; track option) {
                    <label [class]="styles.option">
                        <input
                            type="radio"
                            name="dagre-direction"
                            [value]="option"
                            [checked]="direction() === option"
                            (change)="arrange(option)"
                            [class]="styles.radio"
                        />
                        {{ names[option] }}
                    </label>
                }
            </fieldset>
        </div>
    `,
})
export default class DagreLayout {
    protected readonly styles = styles;
    protected readonly fit = FIT;
    protected readonly directions = DIRECTIONS;
    protected readonly names = DIRECTION_NAMES;
    protected readonly placeOf = placeOf;
    protected readonly model = createFlowModel<Types, typeof features>(
        { version: 1, nodes, edges },
        { features },
    );
    protected readonly flow = createFlowRef<Types, typeof features>();
    protected readonly direction = signal<Direction>(FIRST);
    protected readonly animating = signal(false);
    /** the running animation's stop, so a new direction (or leaving) ends it */
    private stop: (() => void) | undefined;

    constructor() {
        inject(DestroyRef).onDestroy(() => this.stop?.());
    }

    protected label(id: string): string {
        return labelOf(id);
    }

    protected arrange(next: Direction): void {
        const current = this.flow.current;
        if (!current || next === this.direction()) return;
        const { model, engine } = current;
        this.stop?.();
        this.direction.set(next);
        const all = model.get("all-nodes");
        // from where the nodes are now: mid-animation, or after a drag
        const from = new Map(all.map((node) => [node.id, node.position]));
        const to = layoutPositions(
            all.map(boxOf),
            model.get("all-edges"),
            next,
        );
        this.animating.set(true);
        this.stop = everyFrame(DURATION, (t) => {
            if (t < 1) {
                // a step of the animation: transient, as a drag's steps are
                model.run(
                    "batch",
                    { commands: movesTo(tween(from, to, t)) },
                    { transient: true },
                );
                return;
            }
            // the exact places, once: the one change a history or a save keeps
            model.run("batch", { commands: movesTo(to) });
            this.stop = undefined;
            this.animating.set(false);
            engine.run("fit-view", { ...FIT, duration: 300 });
        });
    }
}
