<script module lang="ts">
    import type { FlowEdgeInput, FlowNodeInput, FlowTypes } from "@fragiola/flow-svelte";
    import { connection } from "@fragiola/flow-svelte/connection";
    import { drag } from "@fragiola/flow-svelte/drag";
    import { keyboard } from "@fragiola/flow-svelte/keyboard";
    import { selection } from "@fragiola/flow-svelte/selection";

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

    /** A free id for a node `name` adds: `bob-1`, `bob-2`, … */
    function newNodeId(name: string, taken: readonly { id: string }[]) {
        const ids = new Set(taken.map((entity) => entity.id));
        let n = 1;
        while (ids.has(`${name.toLowerCase()}-${n}`)) n += 1;
        return { id: `${name.toLowerCase()}-${n}`, n };
    }
</script>

<script lang="ts">
    import { createFlowModel, typedFlow, useFlowRef } from "@fragiola/flow-svelte";
    import { PlusIcon } from "@lucide/svelte";
    import CardNode from "./card-node.svelte";
    import Cursors from "./cursors.svelte";
    import { styles } from "./styles";
    import {
        type Presence,
        presenceAfter,
        receive,
        remoteSelection,
        syncModel,
    } from "./sync";
    import { bridgeTabs, createHub, type Peer } from "./transport";

    const Flow = typedFlow<Types, typeof features>();

    const hub = createHub();

    /** One collaborator: their own model and flow, joined to the others through `hub`. */
    function createSide(name: string) {
        const model = createFlowModel<Types, typeof features>(
            { version: 1, nodes, edges },
            { features },
        );
        const flow = useFlowRef<Types, typeof features>();
        let peer: Peer | null = null;
        let presence = $state.raw<Presence>(new Map());
        const selected = $derived(remoteSelection(presence));

        // joined once mounted; left (and the model's listener stopped) when destroyed
        $effect(() => {
            const id = `${name.toLowerCase()}-${Math.random().toString(36).slice(2, 10)}`;
            const joined: Peer = hub.join(id, name, (message) => {
                receive(model, joined, message);
                presence = presenceAfter(presence, message);
            });
            peer = joined;
            const stop = syncModel(model, joined);
            return () => {
                stop();
                joined.leave();
                peer = null;
                presence = new Map();
            };
        });

        function onPointerMove(event: PointerEvent) {
            const engine = flow.current?.engine;
            if (!engine) return;
            const at = engine.get("screen-to-flow", {
                x: event.clientX,
                y: event.clientY,
            });
            peer?.send({ type: "cursor", at });
        }

        function onPointerLeave() {
            peer?.send({ type: "cursor", at: null });
        }

        function addNode() {
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
        }

        return {
            name,
            model,
            flow,
            get presence() {
                return presence;
            },
            get selected() {
                return selected;
            },
            onPointerMove,
            onPointerLeave,
            addNode,
        };
    }

    const sides = [createSide("Alice"), createSide("Bob")];

    // other tabs of this page join over a BroadcastChannel, where the browser has one
    // the page leaving (closed, reloaded, navigated away) closes it too: a destroy does not run
    // then, and the other tabs would keep this page's cursors; a page back from the back-forward
    // cache joins again
    let tabs = $state(false);
    $effect(() => {
        let bridge = bridgeTabs(hub, CHANNEL);
        tabs = bridge.connected;
        const onPageHide = () => bridge.close();
        const onPageShow = (event: PageTransitionEvent) => {
            if (!event.persisted) return;
            bridge = bridgeTabs(hub, CHANNEL);
        };
        window.addEventListener("pagehide", onPageHide);
        window.addEventListener("pageshow", onPageShow);
        return () => {
            window.removeEventListener("pagehide", onPageHide);
            window.removeEventListener("pageshow", onPageShow);
            bridge.close();
        };
    });
</script>

<div class={styles.frame}>
    {#each sides as side (side.name)}
        <section aria-label={side.name} class={styles.side}>
            <Flow.Root
                model={side.model}
                flowRef={side.flow}
                fitView={{ padding: 0.25, maxZoom: 1 }}
                role="group"
                aria-label={`${side.name}'s flow`}
                onpointermove={side.onPointerMove}
                onpointerleave={side.onPointerLeave}
                class={styles.root}
            >
                <Flow.Background variant="dots" size={2} class={styles.dots} />
                <Flow.Background variant="lines" class={styles.lines} />
                <Flow.Background variant="cross" class={styles.cross} />
                <Flow.Viewport>
                    <Flow.Edges>
                        {#snippet children(edge)}
                            <Flow.Edge
                                {edge}
                                role="group"
                                aria-roledescription="edge"
                                aria-label={`${edge.source} to ${edge.target}`}
                                class={styles.edgeGroup}
                            >
                                <Flow.EdgePath class={styles.edge} />
                            </Flow.Edge>
                        {/snippet}
                    </Flow.Edges>
                    <Flow.Nodes>
                        {#snippet children(node)}
                            <CardNode {node} names={side.selected.get(node.id)} />
                        {/snippet}
                    </Flow.Nodes>
                    <Flow.ConnectionLine class={styles.connection} />
                    <Cursors presence={side.presence} />
                </Flow.Viewport>
                <div data-flow-no-gesture="" class={styles.header}>
                    <h2 class={styles.name(side.name)}>{side.name}</h2>
                    <button type="button" onclick={side.addNode} class={styles.button}>
                        <PlusIcon />
                        Add node
                    </button>
                </div>
            </Flow.Root>
        </section>
    {/each}
    <p class={styles.hint}>
        Drag, connect, add or Delete on one side; the other follows{tabs
            ? " · open another tab to join"
            : ""}
    </p>
</div>
