// The flows the tests render, as standalone components (OnPush, Angular 22's default): every
// directive, assembled the way an app does, with no text but the app's own (an edge's id in its
// label). The same flows as packages/svelte's `tests/fixtures/`.
import {
    Component,
    Directive,
    effect,
    input,
    type OnInit,
    signal,
    untracked,
} from "@angular/core";
import { connection } from "@fragiola/flow/connection";
import { minimap } from "@fragiola/flow/minimap";
import { resize } from "@fragiola/flow/resize";
import { selection } from "@fragiola/flow/selection";
import { FLOW_MINIMAP } from "../src/minimap/index";
import {
    type AnyTypes,
    type FitViewPayload,
    FLOW,
    type FlowEdge,
    type FlowEngineOptions,
    type FlowFeatures,
    type FlowModel,
    type FlowNode,
    type FlowRef,
    injectConnection,
    injectFlow,
    injectHandle,
    injectNode,
    injectNodes,
    injectSelection,
    injectViewport,
    type Viewport,
    type ViewportMoveEvent,
} from "../src/public-api";
import { FLOW_RESIZE } from "../src/resize/index";
import { pair } from "./flow";

type Ref = FlowRef<AnyTypes, FlowFeatures>;

/** The root's inputs and outputs every flow takes (React's `RootProps`, as the tests use them). */
@Directive()
export abstract class RootInputs {
    readonly model = input<FlowModel<AnyTypes, FlowFeatures> | undefined>();
    readonly defaultNodes = input<readonly FlowNode[] | undefined>();
    readonly defaultEdges = input<readonly FlowEdge[] | undefined>();
    readonly nodes = input<readonly FlowNode[] | undefined>();
    readonly edges = input<readonly FlowEdge[] | undefined>();
    readonly features = input<FlowFeatures | undefined>();
    readonly viewport = input<Viewport | undefined>();
    readonly defaultViewport = input<Viewport | undefined>();
    readonly fitView = input<boolean | FitViewPayload | undefined>();
    readonly flowRef = input<Ref | undefined>();
    readonly minZoom = input<number | undefined>();
    readonly maxZoom = input<number | undefined>();
    readonly interactive = input<boolean | undefined>();
    readonly autoPan = input<FlowEngineOptions["autoPan"]>();
    readonly panOnDrag = input<FlowEngineOptions["panOnDrag"]>();
    readonly panActivationKey = input<FlowEngineOptions["panActivationKey"]>();
    readonly panOnScrollMode = input<FlowEngineOptions["panOnScrollMode"]>();
    readonly panOnScrollSpeed = input<FlowEngineOptions["panOnScrollSpeed"]>();
    readonly zoomActivationKey =
        input<FlowEngineOptions["zoomActivationKey"]>();
    readonly easing = input<FlowEngineOptions["easing"]>();
    readonly nodeOrigin = input<FlowEngineOptions["nodeOrigin"]>();
    readonly nodeExtent = input<FlowEngineOptions["nodeExtent"]>();
    readonly elevateNodesOnSelect =
        input<FlowEngineOptions["elevateNodesOnSelect"]>();
    readonly elevateEdgesOnSelect =
        input<FlowEngineOptions["elevateEdgesOnSelect"]>();
    readonly onNodesChange = input<(nodes: readonly FlowNode[]) => void>();
    readonly onEdgesChange = input<(edges: readonly FlowEdge[]) => void>();
    readonly onViewportChange = input<(viewport: Viewport) => void>();
    readonly onViewportMove = input<(event: ViewportMoveEvent) => void>();
}

/** The root's inputs, bound. */
const INPUTS = `
    [model]="model()"
    [defaultNodes]="defaultNodes()"
    [defaultEdges]="defaultEdges()"
    [nodes]="nodes()"
    [edges]="edges()"
    [features]="features()"
    [viewport]="viewport()"
    [defaultViewport]="defaultViewport()"
    [fitView]="fitView()"
    [flowRef]="flowRef()"
    [minZoom]="minZoom()"
    [maxZoom]="maxZoom()"
    [interactive]="interactive()"
    [autoPan]="autoPan()"
    [panOnDrag]="panOnDrag()"
    [panActivationKey]="panActivationKey()"
    [panOnScrollMode]="panOnScrollMode()"
    [panOnScrollSpeed]="panOnScrollSpeed()"
    [zoomActivationKey]="zoomActivationKey()"
    [easing]="easing()"
    [nodeOrigin]="nodeOrigin()"
    [nodeExtent]="nodeExtent()"
    [elevateNodesOnSelect]="elevateNodesOnSelect()"
    [elevateEdgesOnSelect]="elevateEdgesOnSelect()"
`;

/**
 * The root's inputs and outputs, bound. An output a template binds marks its component for check
 * on every emit (Angular's listeners do), so every view of its template is checked again: a flow
 * that counts its renders binds none (`INPUTS`).
 */
const ROOT = `${INPUTS}
    (nodesChange)="onNodesChange()?.($event)"
    (edgesChange)="onEdgesChange()?.($event)"
    (viewportChange)="onViewportChange()?.($event)"
    (viewportMove)="onViewportMove()?.($event)"
`;

/** The zoom of the enclosing root, from `injectViewport` (an engine value a template shows). */
@Component({
    selector: "test-zoom-readout",
    template: "{{ viewport().zoom }}",
})
export class ZoomReadout {
    readonly viewport = injectViewport();
}

/**
 * A flow drawn with the core's directives (React's `TestFlow`): nodes with two handles, edges
 * with a path (and, with `label`, a label), the connection line, the selection box, and with
 * `controls` the control buttons.
 */
@Component({
    selector: "test-flow",
    imports: [FLOW, ZoomReadout],
    template: `
        @if (shown()) {
            <div flowRoot ${ROOT}>
                <svg flowBackground></svg>
                <div flowViewport>
                    <div flowEdges>
                        <ng-template flowEdgesItem let-edge>
                            <svg:g [flowEdge]="edge">
                                <svg:path flowEdgePath />
                                @if (label()) {
                                    <xhtml:div flowEdgeLabel>{{ edge.id }}</xhtml:div>
                                }
                            </svg:g>
                        </ng-template>
                    </div>
                    <div flowNodes>
                        <div *flowNodesItem="let node" [flowNode]="node">
                            <div flowHandle type="target" side="top"></div>
                            <div flowHandle type="source" side="bottom"></div>
                        </div>
                    </div>
                    <svg flowConnectionLine></svg>
                </div>
                <div flowSelectionBox></div>
                @if (controls()) {
                    <div flowControls>
                        <button flowZoomIn data-testid="in" (click)="zoomInClick()?.()"></button>
                        <button flowZoomOut data-testid="out"></button>
                        <button flowFitView data-testid="fit"></button>
                        <button flowToggleInteractive data-testid="lock"></button>
                        @if (durations()) {
                            <button flowZoomIn data-testid="in-300" duration="300"></button>
                            <button flowZoomOut data-testid="out-200" [duration]="200"></button>
                            <button flowFitView data-testid="fit-400" [duration]="400"></button>
                        }
                    </div>
                    <test-zoom-readout data-testid="zoom" />
                }
            </div>
        }
    `,
})
export class TestFlow extends RootInputs {
    /** `false` unmounts the flow (the root and everything in it leave the document) */
    readonly shown = input(true);
    readonly label = input(false);
    readonly controls = input(false);
    /** with `controls`, buttons that animate (`duration`) */
    readonly durations = input(false);
    readonly zoomInClick = input<() => void>();
}

/**
 * `TestFlow` with `[(nodes)]` and `[(edges)]` over this component's signals, driven by the test
 * through them.
 */
@Component({
    selector: "test-controlled-flow",
    imports: [FLOW],
    template: `
        <div
            flowRoot
            [model]="model()"
            [features]="features()"
            [flowRef]="flowRef()"
            [(nodes)]="list"
            [(edges)]="links"
            (nodesChange)="onNodesChange()?.($event)"
        >
            <div flowViewport>
                <div flowEdges>
                    <svg:g *flowEdgesItem="let edge" [flowEdge]="edge"></svg:g>
                </div>
                <div flowNodes>
                    <div *flowNodesItem="let node" [flowNode]="node"></div>
                </div>
            </div>
        </div>
    `,
})
export class ControlledFlow implements OnInit {
    readonly model = input<FlowModel<AnyTypes, FlowFeatures> | undefined>();
    readonly features = input<FlowFeatures | undefined>();
    readonly flowRef = input<Ref | undefined>();
    readonly initialNodes = input<readonly FlowNode[] | undefined>();
    readonly initialEdges = input<readonly FlowEdge[] | undefined>();
    readonly onNodesChange = input<(nodes: readonly FlowNode[]) => void>();
    readonly list = signal<readonly FlowNode[] | undefined>(undefined);
    readonly links = signal<readonly FlowEdge[] | undefined>(undefined);

    ngOnInit(): void {
        this.list.set(this.initialNodes());
        this.links.set(this.initialEdges());
    }
}

/** Tells when it is created: a node's content that must survive its node's moves. */
@Component({
    selector: "test-counted",
    template: `<span data-flow-part="label"></span>`,
})
export class Counted implements OnInit {
    readonly id = input.required<string>();
    readonly onMount = input<(id: string) => void>();

    ngOnInit(): void {
        this.onMount()?.(this.id());
    }
}

/**
 * A flow that tells what renders (binding no output of the root's): `onRender(kind, entity)` each
 * time a node's or an edge's template is checked again, `onMount(id)` when a node's content is created. `mark` is read by
 * the templates (a value of the component), `alt` swaps the nodes' template for another,
 * `style`, `viewportStyle` and `nodeStyle` are the root's, the viewport's and each node's styles.
 */
@Component({
    selector: "test-probe-flow",
    imports: [FLOW, Counted],
    template: `
        <div flowRoot ${INPUTS} [style]="style()">
            <div flowViewport [style]="viewportStyle()">
                <div flowEdges>
                    <ng-template flowEdgesItem let-edge>
                        <svg:g [flowEdge]="edge" [attr.data-mark]="mark()">
                            <svg:path flowEdgePath />
                            {{ probe("edge", edge) }}
                        </svg:g>
                    </ng-template>
                </div>
                <div flowNodes>
                    @if (alt()) {
                        <ng-template flowNodesItem let-node>
                            <div [flowNode]="node" [attr.data-mark]="mark()" data-template="b"></div>
                        </ng-template>
                    } @else {
                        <ng-template flowNodesItem let-node>
                            <div [flowNode]="node" [attr.data-mark]="mark()" data-template="a" [style]="nodeStyle()">
                                {{ probe("node", node) }}
                                <test-counted [id]="node.id" [onMount]="onMount()" />
                            </div>
                        </ng-template>
                    }
                </div>
            </div>
        </div>
    `,
})
export class ProbeFlow extends RootInputs {
    readonly onRender =
        input<(kind: string, entity: FlowNode | FlowEdge) => void>();
    readonly onMount = input<(id: string) => void>();
    readonly mark = input("off");
    readonly alt = input(false);
    readonly style = input<string | undefined>();
    readonly viewportStyle = input<string | undefined>();
    readonly nodeStyle = input<string | undefined>();

    /** tells that a template read its entity again; renders nothing */
    probe(kind: string, entity: FlowNode | FlowEdge): string {
        untracked(() => this.onRender()?.(kind, entity));
        return "";
    }
}

/** A handle rendered by hand with `injectHandle`, given its node. */
@Component({ selector: "span[testHandHandle]", template: "" })
export class HandHandle {
    readonly nodeId = input.required<string>({ alias: "testHandHandle" });
    readonly own = injectHandle(() => ({
        type: "source" as const,
        side: "bottom" as const,
        nodeId: this.nodeId(),
    }));
}

/** A node rendered by hand with `injectNode`: an `<article>` whose host is the node, and a handle. */
@Component({
    selector: "article[testHandNode]",
    imports: [HandHandle],
    template: `<span [testHandHandle]="node().id"></span>`,
    host: { "[attr.data-x]": "own.state()?.x" },
})
export class HandNode {
    readonly node = input.required<FlowNode>({ alias: "testHandNode" });
    readonly own = injectNode(this.node);
}

/** Nodes rendered by hand (`injectNode`), or with a toolbar each, and a flow ref. */
@Component({
    selector: "test-hand-flow",
    imports: [FLOW, HandNode],
    template: `
        <div flowRoot ${ROOT}>
            <div flowViewport>
                <div flowNodes>
                    <ng-template flowNodesItem let-node>
                        @if (hand()) {
                            <article [testHandNode]="node"></article>
                        } @else {
                            <div [flowNode]="node">
                                <div flowNodeToolbar data-testid="toolbar"></div>
                            </div>
                        }
                    </ng-template>
                </div>
            </div>
        </div>
    `,
})
export class HandFlow extends RootInputs {
    readonly hand = input(false);
}

/** Tells the selected nodes' ids each time `injectSelection` changes. */
@Component({ selector: "test-selected", template: "" })
export class Selected {
    readonly onSelection = input.required<(ids: string[]) => void>();
    private readonly selected = injectSelection();

    constructor() {
        effect(() => {
            const ids = this.selected().nodes.map((node) => node.id);
            untracked(() => this.onSelection()(ids));
        });
    }
}

/** The features' directives: a resizer per node (`maxWidth`), the minimap, a selection reader. */
@Component({
    selector: "test-feature-flow",
    imports: [FLOW, FLOW_MINIMAP, FLOW_RESIZE, Selected],
    template: `
        <div flowRoot ${ROOT}>
            <div flowViewport>
                <div flowEdges>
                    <svg:g *flowEdgesItem="let edge" [flowEdge]="edge"></svg:g>
                </div>
                <div flowNodes>
                    <div *flowNodesItem="let node" [flowNode]="node">
                        @if (resizer()) {
                            <div flowNodeResizer [maxWidth]="150"></div>
                        }
                    </div>
                </div>
            </div>
            <div flowSelectionBox></div>
            @if (map()) {
                <svg flowMiniMap [width]="200" [height]="150"></svg>
            }
            @if (onSelection(); as selected) {
                <test-selected [onSelection]="selected" />
            }
        </div>
    `,
})
export class FeatureFlow extends RootInputs {
    readonly resizer = input(false);
    readonly map = input(false);
    readonly onSelection = input<(ids: string[]) => void>();
}

/** The connection under way, from `injectConnection`. */
@Component({
    selector: "test-status",
    template: "",
    host: {
        "data-flow-part": "status",
        "[attr.data-status]": "connection()?.status ?? 'none'",
    },
})
export class Status {
    readonly connection = injectConnection();
}

/** A connectable flow: handles, reconnect anchors, the connection line and its status. */
@Component({
    selector: "test-connect-flow",
    imports: [FLOW, Status],
    template: `
        <div flowRoot ${ROOT}>
            <div flowViewport>
                <div flowEdges>
                    <ng-template flowEdgesItem let-edge>
                        <svg:g [flowEdge]="edge">
                            <svg:path flowEdgePath />
                            <svg:circle flowReconnectAnchor end="target" />
                        </svg:g>
                    </ng-template>
                </div>
                <div flowNodes>
                    <div *flowNodesItem="let node" [flowNode]="node">
                        <div flowHandle type="target" side="top"></div>
                        <div flowHandle type="source" side="bottom"></div>
                    </div>
                </div>
                <svg flowConnectionLine></svg>
            </div>
            <test-status />
        </div>
    `,
})
export class ConnectFlow extends RootInputs {}

/** A background of its own: lines, every 10. */
@Component({
    selector: "test-background-flow",
    imports: [FLOW],
    template: `
        <div flowRoot ${ROOT}>
            <svg flowBackground variant="lines" [gap]="10"></svg>
            <div flowViewport></div>
        </div>
    `,
})
export class BackgroundFlow extends RootInputs {}

const contractFeatures = [selection(), connection(), resize(), minimap()];

/**
 * Every directive, the one named `target` given the app's attributes: a test id, a class, a style,
 * a click handler, and its state read through its template reference (`data-state`, its type).
 */
@Component({
    selector: "test-contract-flow",
    imports: [FLOW, FLOW_MINIMAP, FLOW_RESIZE],
    template: `
        <div flowRoot #root="flowRoot" [features]="features" [defaultNodes]="defaultNodes" [defaultEdges]="defaultEdges" [attr.data-testid]="on('root') ? 'case' : null" [class]="on('root') ? classes() : null" [style]="on('root') ? style() : null" (click)="on('root') && clicked()" [attr.data-state]="on('root') ? kind(root.state()) : null">
            <svg flowBackground #background="flowBackground" [attr.data-testid]="on('background') ? 'case' : null" [class]="on('background') ? classes() : null" [style]="on('background') ? style() : null" (click)="on('background') && clicked()" [attr.data-state]="on('background') ? kind(background.state()) : null"></svg>
            <div flowViewport #viewport="flowViewport" [attr.data-testid]="on('viewport') ? 'case' : null" [class]="on('viewport') ? classes() : null" [style]="on('viewport') ? style() : null" (click)="on('viewport') && clicked()" [attr.data-state]="on('viewport') ? kind(viewport.state()) : null">
                <div flowEdges #edges="flowEdges" [attr.data-testid]="on('edges') ? 'case' : null" [class]="on('edges') ? classes() : null" [style]="on('edges') ? style() : null" (click)="on('edges') && clicked()" [attr.data-state]="on('edges') ? kind(edges.state()) : null">
                    <ng-template flowEdgesItem let-edge>
                        <svg:g [flowEdge]="edge" #e="flowEdge" [attr.data-testid]="on('edge') ? 'case' : null" [class]="on('edge') ? classes() : null" [style]="on('edge') ? style() : null" (click)="on('edge') && clicked()" [attr.data-state]="on('edge') ? kind(e.state()) : null">
                            <svg:path flowEdgePath #p="flowEdgePath" [attr.data-testid]="on('edge-path') ? 'case' : null" [class]="on('edge-path') ? classes() : null" [style]="on('edge-path') ? style() : null" (click)="on('edge-path') && clicked()" [attr.data-state]="on('edge-path') ? kind(p.state()) : null" />
                            <xhtml:div flowEdgeLabel #l="flowEdgeLabel" [attr.data-testid]="on('edge-label') ? 'case' : null" [class]="on('edge-label') ? classes() : null" [style]="on('edge-label') ? style() : null" (click)="on('edge-label') && clicked()" [attr.data-state]="on('edge-label') ? kind(l.state()) : null"></xhtml:div>
                            <svg:circle flowReconnectAnchor end="target" #a="flowReconnectAnchor" [attr.data-testid]="on('reconnect-anchor') ? 'case' : null" [class]="on('reconnect-anchor') ? classes() : null" [style]="on('reconnect-anchor') ? style() : null" (click)="on('reconnect-anchor') && clicked()" [attr.data-state]="on('reconnect-anchor') ? kind(a.state()) : null" />
                            <xhtml:div flowEdgeToolbar [open]="true" #et="flowEdgeToolbar" [attr.data-testid]="on('edge-toolbar') ? 'case' : null" [class]="on('edge-toolbar') ? classes() : null" [style]="on('edge-toolbar') ? style() : null" (click)="on('edge-toolbar') && clicked()" [attr.data-state]="on('edge-toolbar') ? kind(et.state()) : null"></xhtml:div>
                        </svg:g>
                    </ng-template>
                </div>
                <div flowNodes #nodes="flowNodes" [attr.data-testid]="on('nodes') ? 'case' : null" [class]="on('nodes') ? classes() : null" [style]="on('nodes') ? style() : null" (click)="on('nodes') && clicked()" [attr.data-state]="on('nodes') ? kind(nodes.state()) : null">
                    <ng-template flowNodesItem let-node>
                        <div [flowNode]="node" #n="flowNode" [attr.data-selected-state]="n.state()?.selected" [attr.data-testid]="on('node') ? 'case' : null" [class]="on('node') ? classes() : null" [style]="on('node') ? style() : null" (click)="on('node') && clicked()" [attr.data-state]="on('node') ? kind(n.state()) : null">
                            <div flowHandle type="target" side="top" #h="flowHandle" [attr.data-testid]="on('handle') ? 'case' : null" [class]="on('handle') ? classes() : null" [style]="on('handle') ? style() : null" (click)="on('handle') && clicked()" [attr.data-state]="on('handle') ? kind(h.state()) : null"></div>
                            <div flowHandle type="source" side="bottom"></div>
                            @if (node.id === "a") {
                                <div flowNodeResizer #r="flowNodeResizer" [attr.data-testid]="on('resizer') ? 'case' : null" [class]="on('resizer') ? classes() : null" [style]="on('resizer') ? style() : null" (click)="on('resizer') && clicked()" [attr.data-state]="on('resizer') ? kind(r.state()) : null">
                                    <div flowResizeHandle position="bottom-right" #rh="flowResizeHandle" [attr.data-testid]="on('resize-handle') ? 'case' : null" [class]="on('resize-handle') ? classes() : null" [style]="on('resize-handle') ? style() : null" (click)="on('resize-handle') && clicked()" [attr.data-state]="on('resize-handle') ? kind(rh.state()) : null"></div>
                                </div>
                                <div flowNodeToolbar [open]="true" #t="flowNodeToolbar" [attr.data-testid]="on('toolbar') ? 'case' : null" [class]="on('toolbar') ? classes() : null" [style]="on('toolbar') ? style() : null" (click)="on('toolbar') && clicked()" [attr.data-state]="on('toolbar') ? kind(t.state()) : null"></div>
                            }
                        </div>
                    </ng-template>
                </div>
                <svg flowConnectionLine #line="flowConnectionLine" [attr.data-testid]="on('connection-line') ? 'case' : null" [class]="on('connection-line') ? classes() : null" [style]="on('connection-line') ? style() : null" (click)="on('connection-line') && clicked()" [attr.data-state]="on('connection-line') ? kind(line.state()) : null"></svg>
                <div flowNodesSelection #ns="flowNodesSelection" [attr.data-testid]="on('nodes-selection') ? 'case' : null" [class]="on('nodes-selection') ? classes() : null" [style]="on('nodes-selection') ? style() : null" (click)="on('nodes-selection') && clicked()" [attr.data-state]="on('nodes-selection') ? kind(ns.state()) : null"></div>
            </div>
            <div flowSelectionBox #box="flowSelectionBox" [attr.data-testid]="on('selection-box') ? 'case' : null" [class]="on('selection-box') ? classes() : null" [style]="on('selection-box') ? style() : null" (click)="on('selection-box') && clicked()" [attr.data-state]="on('selection-box') ? kind(box.state()) : null"></div>
            <div flowControls #controls="flowControls" [attr.data-testid]="on('controls') ? 'case' : null" [class]="on('controls') ? classes() : null" [style]="on('controls') ? style() : null" (click)="on('controls') && clicked()" [attr.data-state]="on('controls') ? kind(controls.state()) : null">
                <button flowZoomIn #zi="flowZoomIn" [attr.data-testid]="on('zoom-in') ? 'case' : null" [class]="on('zoom-in') ? classes() : null" [style]="on('zoom-in') ? style() : null" (click)="on('zoom-in') && clicked()" [attr.data-state]="on('zoom-in') ? kind(zi.state()) : null"></button>
                <button flowZoomOut #zo="flowZoomOut" [attr.data-testid]="on('zoom-out') ? 'case' : null" [class]="on('zoom-out') ? classes() : null" [style]="on('zoom-out') ? style() : null" (click)="on('zoom-out') && clicked()" [attr.data-state]="on('zoom-out') ? kind(zo.state()) : null"></button>
                <button flowFitView #fv="flowFitView" [attr.data-testid]="on('fit-view') ? 'case' : null" [class]="on('fit-view') ? classes() : null" [style]="on('fit-view') ? style() : null" (click)="on('fit-view') && clicked()" [attr.data-state]="on('fit-view') ? kind(fv.state()) : null"></button>
                <button flowToggleInteractive #ti="flowToggleInteractive" [attr.data-testid]="on('toggle-interactive') ? 'case' : null" [class]="on('toggle-interactive') ? classes() : null" [style]="on('toggle-interactive') ? style() : null" (click)="on('toggle-interactive') && clicked()" [attr.data-state]="on('toggle-interactive') ? kind(ti.state()) : null"></button>
            </div>
            <svg flowMiniMap #map="flowMiniMap" [attr.data-testid]="on('minimap') ? 'case' : null" [class]="on('minimap') ? classes() : null" [style]="on('minimap') ? style() : null" (click)="on('minimap') && clicked()" [attr.data-state]="on('minimap') ? kind(map.state()) : null">
                <svg:rect flowMiniMapNode nodeId="a" #mn="flowMiniMapNode" [attr.data-testid]="on('minimap-node') ? 'case' : null" [class]="on('minimap-node') ? classes() : null" [style]="on('minimap-node') ? style() : null" (click)="on('minimap-node') && clicked()" [attr.data-state]="on('minimap-node') ? kind(mn.state()) : null" />
                <svg:path flowMiniMapMask #mm="flowMiniMapMask" [attr.data-testid]="on('minimap-mask') ? 'case' : null" [class]="on('minimap-mask') ? classes() : null" [style]="on('minimap-mask') ? style() : null" (click)="on('minimap-mask') && clicked()" [attr.data-state]="on('minimap-mask') ? kind(mm.state()) : null" />
            </svg>
        </div>
    `,
})
export class ContractFlow {
    readonly target = input.required<string>();
    readonly classes = input<Record<string, boolean> | string | undefined>();
    readonly style = input<Record<string, string> | string | undefined>();
    readonly onClick = input<() => void>();

    readonly features = contractFeatures;
    readonly defaultNodes = pair().nodes.map((node) =>
        node.id === "a" ? { ...node, selected: true } : node,
    );
    readonly defaultEdges = pair().edges;

    on(name: string): boolean {
        return this.target() === name;
    }

    clicked(): void {
        this.onClick()?.();
    }

    kind(state: unknown): string {
        return state === null ? "null" : typeof state;
    }
}

/** Reads the root's model in its constructor (too early), and its nodes in its template. */
@Component({
    selector: "test-early-reader",
    template: "{{ nodes().length }}",
})
export class EarlyReader {
    static error: unknown;
    readonly nodes = injectNodes();

    constructor() {
        const flow = injectFlow();
        try {
            flow.model();
        } catch (error) {
            EarlyReader.error = error;
        }
    }
}

/**
 * Edges whose labels sit beside them in their template, given their edge (`[edgeId]`), and a
 * child that reads the model too early.
 */
@Component({
    selector: "test-label-flow",
    imports: [FLOW, EarlyReader],
    template: `
        <div flowRoot ${INPUTS}>
            <div flowViewport>
                <div flowEdges>
                    <ng-template flowEdgesItem let-edge>
                        <svg:g [flowEdge]="edge"></svg:g>
                        <xhtml:div flowEdgeLabel [edgeId]="edge.id">{{ edge.id }}</xhtml:div>
                    </ng-template>
                </div>
                <div flowNodes>
                    <div *flowNodesItem="let node" [flowNode]="node"></div>
                </div>
            </div>
            <test-early-reader data-testid="count" />
        </div>
    `,
})
export class LabelFlow extends RootInputs {}

/**
 * #28 (#36): nodes `a` and `b`, an edge with a toolbar (`edgeToolbar`'s inputs), and with `nodeIds` a
 * toolbar beside those nodes.
 */
@Component({
    selector: "test-toolbar-flow",
    imports: [FLOW],
    template: `
        <div flowRoot ${INPUTS}>
            <div flowViewport>
                <div flowEdges>
                    <ng-template flowEdgesItem let-edge>
                        <svg:g [flowEdge]="edge">
                            <svg:path flowEdgePath />
                            <xhtml:div flowEdgeToolbar data-testid="edge-toolbar" [open]="edgeToolbar().open" [position]="edgeToolbar().position" [offset]="edgeToolbar().offset" [point]="edgeToolbar().point" [alignX]="edgeToolbar().alignX" [alignY]="edgeToolbar().alignY">
                                <xhtml:button type="button">x</xhtml:button>
                            </xhtml:div>
                        </svg:g>
                    </ng-template>
                </div>
                <div flowNodes>
                    <div *flowNodesItem="let node" [flowNode]="node">
                        <div flowHandle type="target" side="top"></div>
                        <div flowHandle type="source" side="bottom"></div>
                    </div>
                </div>
            </div>
            @if (nodeIds(); as ids) {
                <div flowNodeToolbar data-testid="nodes-toolbar" [nodeIds]="ids"></div>
            }
        </div>
    `,
})
export class ToolbarFlow extends RootInputs {
    readonly edgeToolbar = input<{
        open?: boolean;
        position?: "label" | "source" | "target";
        offset?: { x: number; y: number };
        point?: { x: number; y: number };
        alignX?: "start" | "center" | "end";
        alignY?: "start" | "center" | "end";
    }>({});
    readonly nodeIds = input<readonly string[] | undefined>();
}

/** #28: handles and resize handles (`[flowNodeResizer]`'s defaults), with the given features. */
@Component({
    selector: "test-keyboard-flow",
    imports: [FLOW, FLOW_RESIZE],
    template: `
        <div flowRoot ${INPUTS}>
            <div flowViewport>
                <div flowEdges>
                    <svg:g *flowEdgesItem="let edge" [flowEdge]="edge"></svg:g>
                </div>
                <div flowNodes>
                    <div *flowNodesItem="let node" [flowNode]="node">
                        <div flowHandle type="target" side="top"></div>
                        <div flowHandle type="source" side="bottom"></div>
                        <div flowNodeResizer></div>
                    </div>
                </div>
                <svg flowConnectionLine></svg>
            </div>
        </div>
    `,
})
export class KeyboardFlow extends RootInputs {}

/**
 * #28's review: an edge toolbar given its edge outside it, a node toolbar of `nodeIds` in each
 * node, and with `orphan` an edge toolbar without an edge.
 */
@Component({
    selector: "test-outside-toolbar-flow",
    imports: [FLOW],
    template: `
        <div flowRoot ${INPUTS}>
            <div flowViewport>
                <div flowEdges>
                    <svg:g *flowEdgesItem="let edge" [flowEdge]="edge"></svg:g>
                </div>
                <div flowNodes>
                    <div *flowNodesItem="let node" [flowNode]="node">
                        @if (nodeIds(); as ids) {
                            <div flowNodeToolbar [attr.data-testid]="'node-toolbar-' + node.id" [nodeIds]="ids"></div>
                        }
                    </div>
                </div>
            </div>
            <div flowEdgeToolbar data-testid="edge-toolbar" edgeId="ab" open></div>
            @if (orphan()) {
                <div flowEdgeToolbar></div>
            }
        </div>
    `,
})
export class OutsideToolbarFlow extends RootInputs {
    readonly orphan = input(false);
    readonly nodeIds = input<readonly string[] | undefined>();
}
