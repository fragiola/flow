import {
    afterNextRender,
    Component,
    computed,
    DestroyRef,
    DOCUMENT,
    ElementRef,
    inject,
    signal,
    viewChildren,
} from "@angular/core";
import {
    createFlowModel,
    createFlowRef,
    FLOW,
    type FlowEdgeInput,
    type FlowNodeInput,
    type FlowTypes,
} from "@fragiola/flow-angular";
import { connection } from "@fragiola/flow-angular/connection";
import { drag } from "@fragiola/flow-angular/drag";
import { keyboard } from "@fragiola/flow-angular/keyboard";
import { selection } from "@fragiola/flow-angular/selection";
import { LucidePlus } from "@lucide/angular";
import { CardNode } from "./card-node";
import { Cursors } from "./cursors";
import { styles } from "./styles";
import {
    type Presence,
    presenceAfter,
    receive,
    remoteSelection,
    syncModel,
} from "./sync";
import { bridgeTabs, createHub, type Hub, type Peer } from "./transport";

// Two collaborators, Alice and Bob, edit one document, each in a flow of their own. Each side's
// model is its own; `sync.ts` listens to it (`model.subscribe`) and sends what every local command
// changed over a transport (`transport.ts`: a hub in memory for this page, a `BroadcastChannel` to
// other tabs of it). The other side applies it as one `batch` of the commands `commands-to` gives,
// marked as remote so it is never sent back; the last command to arrive wins. A drag's transient
// moves are sent as they come, so the other side follows it. Where each pointer is (in flow
// coordinates, `screen-to-flow`) and what each side selects travel as presence: the other flow
// shows the collaborator's cursor with their name, and a dashed frame around the nodes they have
// selected. Open the page in another tab: it joins the same document.

export interface Types extends FlowTypes {
    readonly nodes: { card: { label: string } };
}

export const features = [
    selection(),
    drag(),
    connection(),
    keyboard(),
] as const;

/** The channel other tabs of this example meet on. */
const CHANNEL = "fragiola-flow-collaborative";

const nodes: FlowNodeInput<Types>[] = [
    {
        id: "plan",
        type: "card",
        position: { x: 0, y: 0 },
        data: { label: "Plan" },
    },
    {
        id: "write",
        type: "card",
        position: { x: 200, y: 0 },
        data: { label: "Write" },
    },
    {
        id: "ship",
        type: "card",
        position: { x: 100, y: 130 },
        data: { label: "Ship" },
    },
];

const edges: FlowEdgeInput<Types>[] = [
    { id: "plan-write", source: "plan", target: "write" },
];

type RemoteSelection = ReadonlyMap<string, readonly string[]>;

/** Whether two remote selections mark the same nodes with the same names. */
function sameSelection(a: RemoteSelection, b: RemoteSelection) {
    if (a.size !== b.size) return false;
    for (const [id, names] of a)
        if (b.get(id)?.join("\n") !== names.join("\n")) return false;
    return true;
}

/** A free id for a node `name` adds: `bob-1`, `bob-2`, … */
function newNodeId(name: string, taken: readonly { id: string }[]) {
    const ids = new Set(taken.map((entity) => entity.id));
    let n = 1;
    while (ids.has(`${name.toLowerCase()}-${n}`)) n += 1;
    return { id: `${name.toLowerCase()}-${n}`, n };
}

/**
 * One collaborator: their own model and flow, joined to the others through `hub` (in an injection
 * context: they leave, and the model's listener stops, when the component is destroyed).
 */
function createSide(name: string, hub: Hub) {
    const model = createFlowModel<Types, typeof features>(
        { version: 1, nodes, edges },
        { features },
    );
    const flow = createFlowRef<Types, typeof features>();
    const presence = signal<Presence>(new Map());
    // a cursor step changes the presence, not the selection: the nodes are not checked for it
    const selected = computed(() => remoteSelection(presence()), {
        equal: sameSelection,
    });

    const id = `${name.toLowerCase()}-${Math.random().toString(36).slice(2, 10)}`;
    const peer: Peer = hub.join(id, name, (message) => {
        receive(model, peer, message);
        presence.update((current) => presenceAfter(current, message));
    });
    const stop = syncModel(model, peer);

    // plain listeners, not template bindings, which would check the whole template (every node)
    // on every pointer step
    const onPointerMove = (event: PointerEvent) => {
        const engine = flow.current?.engine;
        if (!engine) return;
        const at = engine.get("screen-to-flow", {
            x: event.clientX,
            y: event.clientY,
        });
        peer.send({ type: "cursor", at });
    };
    const onPointerLeave = () => peer.send({ type: "cursor", at: null });
    let element: HTMLElement | undefined;

    inject(DestroyRef).onDestroy(() => {
        element?.removeEventListener("pointermove", onPointerMove);
        element?.removeEventListener("pointerleave", onPointerLeave);
        stop();
        peer.leave();
    });

    return {
        name,
        label: `${name}'s flow`,
        model,
        flow,
        presence: presence.asReadonly(),
        selected,
        /** Listens to the pointer over the side's root, once it is rendered. */
        attach(root: HTMLElement) {
            element = root;
            root.addEventListener("pointermove", onPointerMove);
            root.addEventListener("pointerleave", onPointerLeave);
        },
        addNode() {
            const { id, n } = newNodeId(name, model.get("flow-json").nodes);
            model.run("node.add", {
                id,
                type: "card",
                position: {
                    x: ((n - 1) % 3) * 140,
                    y: 260 + Math.floor((n - 1) / 3) * 70,
                },
                data: { label: `${name} ${n}` },
            });
        },
    };
}

@Component({
    selector: "example-collaborative",
    imports: [FLOW, CardNode, Cursors, LucidePlus],
    host: { class: "contents" },
    template: `
        <div [class]="styles.frame">
            @for (side of sides; track side.name) {
                <section [attr.aria-label]="side.name" [class]="styles.side">
                    <div
                        #root
                        flowRoot
                        [model]="side.model"
                        [flowRef]="side.flow"
                        [fitView]="{ padding: 0.25, maxZoom: 1 }"
                        role="group"
                        [attr.aria-label]="side.label"
                        [class]="styles.root"
                    >
                        <svg flowBackground variant="dots" [size]="2" [class]="styles.dots"></svg>
                        <svg flowBackground variant="lines" [class]="styles.lines"></svg>
                        <svg flowBackground variant="cross" [class]="styles.cross"></svg>
                        <div flowViewport>
                            <div flowEdges>
                                <ng-template [flowEdgesItem]="side.model" let-edge>
                                    <svg:g
                                        [flowEdge]="edge"
                                        role="group"
                                        aria-roledescription="edge"
                                        [attr.aria-label]="edge.source + ' to ' + edge.target"
                                        [class]="styles.edgeGroup"
                                    >
                                        <svg:path flowEdgePath [class]="styles.edge" />
                                    </svg:g>
                                </ng-template>
                            </div>
                            <div flowNodes>
                                <ng-template [flowNodesItem]="side.model" let-node>
                                    <div
                                        [flowNode]="node"
                                        exampleCardNode
                                        [names]="side.selected().get(node.id)"
                                        role="group"
                                        aria-roledescription="node"
                                        [attr.aria-label]="node.data.label"
                                        [class]="styles.node"
                                    ></div>
                                </ng-template>
                            </div>
                            <svg flowConnectionLine [class]="styles.connection"></svg>
                            <example-cursors [presence]="side.presence" />
                        </div>
                        <div data-flow-no-gesture="" [class]="styles.header">
                            <h2 [class]="styles.name(side.name)">{{ side.name }}</h2>
                            <button type="button" (click)="side.addNode()" [class]="styles.button">
                                <svg lucidePlus aria-hidden="true"></svg>
                                Add node
                            </button>
                        </div>
                    </div>
                </section>
            }
            <p [class]="styles.hint">
                Drag, connect, add or Delete on one side; the other follows{{
                    tabs() ? " · open another tab to join" : ""
                }}
            </p>
        </div>
    `,
})
export default class CollaborativeExample {
    protected readonly styles = styles;
    private readonly hub = createHub();
    protected readonly sides = [
        createSide("Alice", this.hub),
        createSide("Bob", this.hub),
    ];
    protected readonly tabs = signal(false);
    private readonly roots = viewChildren<string, ElementRef<HTMLElement>>(
        "root",
        { read: ElementRef },
    );

    constructor() {
        afterNextRender(() => {
            const roots = this.roots();
            this.sides.forEach((side, index) => {
                const root = roots[index];
                if (root) side.attach(root.nativeElement);
            });
        });

        // other tabs of this page join over a BroadcastChannel, where the browser has one
        // the page leaving (closed, reloaded, navigated away) closes it too: a destroy does not
        // run then, and the other tabs would keep this page's cursors; a page back from the
        // back-forward cache joins again
        const window = inject(DOCUMENT).defaultView;
        let bridge = bridgeTabs(this.hub, CHANNEL);
        this.tabs.set(bridge.connected);
        const onPageHide = () => bridge.close();
        const onPageShow = (event: PageTransitionEvent) => {
            if (!event.persisted) return;
            bridge = bridgeTabs(this.hub, CHANNEL);
        };
        window?.addEventListener("pagehide", onPageHide);
        window?.addEventListener("pageshow", onPageShow);
        inject(DestroyRef).onDestroy(() => {
            window?.removeEventListener("pagehide", onPageHide);
            window?.removeEventListener("pageshow", onPageShow);
            bridge.close();
        });
    }
}
