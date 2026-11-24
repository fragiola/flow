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
import { AddButton } from "./add-button";
import { layoutPositions, type Point } from "./layout";
import { styles } from "./styles";
import { Toggle } from "./toggle";
import {
    addChildCommands,
    type PlaceholderData,
    placeholderEdge,
    placeholderNode,
    type TopicData,
    toggleCommands,
    topicData,
    topicEdge,
    topicNode,
} from "./tree";
import { TreeEdge } from "./tree-edge";
import { tween } from "./tween";

// A mind map that lays itself out again after every change (dagre, top to bottom, `layout.ts`).
// Under each shown topic sits a "+" placeholder, a node of its own (`add-<topic>`) with a dashed
// edge, laid out like the rest: pressing it (add-button.ts, `(add)`) adds a child in one `batch`
// (the topic, its edge, its own placeholder and that edge, `tree.ts`), starting at its parent's
// place. A topic with children has a toggle that collapses its subtree (toggle.ts, `(toggle)`):
// one `batch` writes `collapsed` in its data (`node.set-data`) and hides every descendant, their
// placeholders, its own, and the edges into them (`node.set-flags` / `edge.set-flags { hidden }`);
// expanding shows them again, except under a topic still collapsed. The layout runs on the shown
// nodes only, and they glide to their new places: one transient `batch` of `node.move` per
// animation frame (`tween.ts`), then one batch that is not transient with the exact places, then
// `fit-view` animated. The root carries `data-animating` while the nodes move and `data-layouts`,
// the number of layouts finished (for a test to wait on the one a press starts); a collapsed topic
// carries `data-collapsed`. An edge is named by its topics (tree-edge.ts, on the edge's group);
// leaving stops the animation's frames (`DestroyRef`).

/**
 * `tree.ts`'s data, as type literals: `[flowNode]`'s fallback data is a `Record`, which an
 * interface is not assignable to (a mapped type is).
 */
type Plain<T> = { [K in keyof T]: T[K] };

export interface Types extends FlowTypes {
    readonly nodes: { topic: Plain<TopicData>; add: Plain<PlaceholderData> };
}

export const features = [selection(), drag()] as const;

/** How long the nodes take to reach their new places, in milliseconds. */
const DURATION = 350;

/** How the view fits the tree: some room around it, never zoomed in past 1. */
const FIT = { padding: 0.15, maxZoom: 1 };

/** The map: a product launch, its teams and their first tasks. */
const TOPICS: readonly (readonly [
    id: string,
    label: string,
    parent?: string,
])[] = [
    ["launch", "Product launch"],
    ["marketing", "Marketing", "launch"],
    ["engineering", "Engineering", "launch"],
    ["support", "Support", "launch"],
    ["campaign", "Campaign", "marketing"],
    ["press", "Press kit", "marketing"],
    ["backend", "Backend", "engineering"],
    ["frontend", "Frontend", "engineering"],
    ["docs", "Help center", "support"],
];

const ORIGIN = { x: 0, y: 0 };

const firstNodes = TOPICS.flatMap(([id, label]) => [
    topicNode(id, label, ORIGIN),
    placeholderNode(id, label, ORIGIN),
]);

const edges: FlowEdgeInput<Types>[] = TOPICS.flatMap(([id, , parent]) => [
    ...(parent ? [topicEdge(parent, id)] : []),
    placeholderEdge(id),
]);

/** What the layout reads of a node: its id, declared size and whether it shows. */
const boxOf = (node: {
    id: string;
    width?: number;
    height?: number;
    hidden?: boolean;
}) => ({
    id: node.id,
    width: node.width ?? 0,
    height: node.height ?? 0,
    hidden: node.hidden,
});

// laid out before the first render: the map opens arranged, with nothing to animate
const firstPlaces = layoutPositions(firstNodes.map(boxOf), edges);

const nodes: FlowNodeInput<Types>[] = firstNodes.map((node) => ({
    ...node,
    position: firstPlaces.get(node.id) ?? ORIGIN,
}));

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
    selector: "example-auto-layout",
    imports: [FLOW, AddButton, Toggle, TreeEdge],
    host: { class: "contents" },
    template: `
        <div
            flowRoot
            [model]="model"
            [fitView]="fit"
            [flowRef]="flow"
            role="group"
            aria-label="Auto layout"
            [attr.data-animating]="animating() ? '' : null"
            [attr.data-layouts]="layouts()"
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
                            exampleTreeEdge
                            role="group"
                            aria-roledescription="edge"
                            [class]="styles.edgeGroup"
                        ></svg:g>
                    </ng-template>
                </div>
                <div flowNodes>
                    <ng-template [flowNodesItem]="model" let-node>
                        @if (node.type === "add") {
                            <div [flowNode]="node" [class]="styles.placeholder">
                                <div
                                    flowHandle
                                    type="target"
                                    side="top"
                                    [class]="styles.placeholderHandle"
                                ></div>
                                <button exampleAddButton [data]="node.data" (add)="add($event)"></button>
                            </div>
                        } @else {
                            <div
                                [flowNode]="node"
                                role="group"
                                aria-roledescription="node"
                                [attr.aria-label]="node.data.label"
                                [attr.data-position]="placeOf(node.position)"
                                [attr.data-collapsed]="node.data.collapsed ? '' : null"
                                [class]="styles.node"
                            >
                                <div flowHandle type="target" side="top" [class]="styles.handle"></div>
                                <span [class]="styles.label">{{ node.data.label }}</span>
                                <example-auto-layout-toggle [node]="node" (toggle)="toggle($event)" />
                                <div flowHandle type="source" side="bottom" [class]="styles.handle"></div>
                            </div>
                        }
                    </ng-template>
                </div>
            </div>
        </div>
    `,
})
export default class AutoLayout {
    protected readonly styles = styles;
    protected readonly fit = FIT;
    protected readonly placeOf = placeOf;
    protected readonly model = createFlowModel<Types, typeof features>(
        { version: 1, nodes, edges },
        { features },
    );
    protected readonly flow = createFlowRef<Types, typeof features>();
    protected readonly animating = signal(false);
    protected readonly layouts = signal(0);
    /** the running animation's stop, so a new change (or leaving) ends it */
    private stop: (() => void) | undefined;
    /** the next added topic's number: `topic-1` "Topic 1", `topic-2` "Topic 2", … */
    private counter = 1;

    constructor() {
        inject(DestroyRef).onDestroy(() => this.stop?.());
    }

    /** Adds a child under a topic (the placeholders' `(add)`). */
    protected add(parentId: string): void {
        const model = this.flow.current?.model;
        const parent = model?.get("node-by", { id: parentId });
        if (!model || !parent) return;
        const number = this.counter++;
        const id = `topic-${number}`;
        const label = `Topic ${number}`;
        // the topic, its edge, its placeholder and that edge: one change
        model.run("batch", { commands: addChildCommands(parent, id, label) });
        this.relayout();
    }

    /** Collapses or expands a topic (the toggles' `(toggle)`). */
    protected toggle(topicId: string): void {
        const model = this.flow.current?.model;
        const topic = model?.get("node-by", { id: topicId });
        if (!model || !topic) return;
        const all = model.get("all-nodes");
        const collapsed = topicData(topic).collapsed !== true;
        const commands = toggleCommands(
            all,
            model.get("all-edges"),
            topicId,
            collapsed,
        );
        // the nodes an expand shows again start at their topic's place, then spread out
        const shown = commands.flatMap((entry) =>
            entry.command === "node.set-flags" && !entry.payload.hidden
                ? [entry.payload.nodeId]
                : [],
        );
        const starts = new Map(shown.map((id) => [id, topic.position]));
        // the flag, the hidden flags and the starting places: one change
        model.run("batch", { commands: [...commands, ...movesTo(starts)] });
        this.relayout();
    }

    /** Lays the shown nodes out again and glides them there from where they are. */
    private relayout(): void {
        const current = this.flow.current;
        if (!current) return;
        const { model, engine } = current;
        this.stop?.();
        const all = model.get("all-nodes");
        // from where the nodes are now: mid-animation, or after a drag
        const from = new Map(all.map((node) => [node.id, node.position]));
        const to = layoutPositions(all.map(boxOf), model.get("all-edges"));
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
            this.layouts.update((count) => count + 1);
            engine.run("fit-view", { ...FIT, duration: 300 });
        });
    }
}
