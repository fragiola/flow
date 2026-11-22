<script module lang="ts">
    import type { FlowNodeInput, FlowTypes, XY } from "@fragiola/flow-svelte";
    import { drag } from "@fragiola/flow-svelte/drag";
    import { selection } from "@fragiola/flow-svelte/selection";

    // A context menu of your own. The root tells a right click (or the menu key) where it
    // happened: `onnodecontextmenu` on a node, `onselectioncontextmenu` on one of several selected
    // nodes, `onpanecontextmenu` on the canvas, each with the client point (`client`), the flow
    // point (`point`) and the DOM event, whose default the example prevents to show its menu
    // instead of the browser's. The menu stands at the client point inside the frame; a click on
    // the canvas, Escape, a pan or a choice closes it. `onnodedoubleclick` marks a task done. These
    // come from the engine's own taps: a right click that ended a pan opens nothing.

    interface Types extends FlowTypes {
        readonly nodes: { task: { label: string; done: boolean } };
    }

    const features = [selection(), drag()] as const;

    const nodes: FlowNodeInput<Types>[] = [
        {
            id: "plan",
            type: "task",
            position: { x: 0, y: 0 },
            data: { label: "Plan", done: false },
        },
        {
            id: "build",
            type: "task",
            position: { x: 200, y: 80 },
            data: { label: "Build", done: false },
        },
        {
            id: "ship",
            type: "task",
            position: { x: 400, y: 0 },
            data: { label: "Ship", done: false },
        },
    ];

    /** What the menu acts on, and where it stands (relative to the frame). */
    type Menu =
        | { kind: "node"; nodeId: string; at: XY }
        | { kind: "selection"; nodeIds: readonly string[]; at: XY }
        | { kind: "pane"; point: XY; at: XY };

    let added = 0;
</script>

<script lang="ts">
    import {
        type FlowEngineEventOf,
        typedFlow,
        useFlowRef,
    } from "@fragiola/flow-svelte";
    import { styles } from "./styles";

    const Flow = typedFlow<Types, typeof features>();
    const flow = useFlowRef<Types, typeof features>();
    let frame = $state<HTMLDivElement>();
    let menu = $state.raw<Menu | null>(null);
    let first = $state<HTMLButtonElement>();

    $effect(() => {
        if (menu) first?.focus();
    });

    /** The menu's place: the client point, inside the frame. */
    const at = (client: XY): XY => {
        const box = frame?.getBoundingClientRect();
        return { x: client.x - (box?.x ?? 0), y: client.y - (box?.y ?? 0) };
    };

    /** Opens a menu instead of the browser's. */
    const open = (
        event: { event: MouseEvent; client: XY },
        next: (where: XY) => Menu,
    ) => {
        event.event.preventDefault();
        menu = next(at(event.client));
    };

    const onNode = (event: FlowEngineEventOf<"node-context-menu">) =>
        open(event, (where) => ({
            kind: "node",
            nodeId: event.nodeId,
            at: where,
        }));
    const onSelection = (event: FlowEngineEventOf<"selection-context-menu">) =>
        open(event, (where) => ({
            kind: "selection",
            nodeIds: event.nodeIds,
            at: where,
        }));
    const onPane = (event: FlowEngineEventOf<"pane-context-menu">) =>
        open(event, (where) => ({
            kind: "pane",
            point: event.point,
            at: where,
        }));

    const close = () => {
        menu = null;
    };
    const model = () => flow.current?.model;

    const duplicate = (nodeId: string) => {
        const node = model()?.get("node-by", { id: nodeId });
        if (!node) return;
        added += 1;
        model()?.run("node.add", {
            id: `${nodeId}-copy-${added}`,
            type: "task",
            position: { x: node.position.x + 30, y: node.position.y + 60 },
            data: { label: `${node.data.label} copy`, done: false },
        });
        close();
    };
    const remove = (nodeIds: readonly string[]) => {
        model()?.run("batch", {
            commands: nodeIds.map((nodeId) => ({
                command: "node.remove" as const,
                payload: { nodeId },
            })),
        });
        close();
    };
    const addAt = (point: XY) => {
        added += 1;
        model()?.run("node.add", {
            id: `task-${added}`,
            type: "task",
            position: point,
            data: { label: `Task ${added}`, done: false },
        });
        close();
    };

    const onDoubleClick = (event: FlowEngineEventOf<"node-double-click">) => {
        const node = model()?.get("node-by", { id: event.nodeId });
        if (node)
            model()?.run("node.set-data", {
                nodeId: node.id,
                data: { done: !node.data.done },
            });
    };
</script>

<div bind:this={frame} class={styles.frame}>
    <Flow.Root
        {features}
        defaultNodes={nodes}
        fitView={{ padding: 0.3, maxZoom: 1 }}
        flowRef={flow}
        onnodecontextmenu={onNode}
        onselectioncontextmenu={onSelection}
        onpanecontextmenu={onPane}
        onpaneclick={close}
        onmovestart={close}
        onnodedoubleclick={onDoubleClick}
        class={styles.root}
    >
        <Flow.Background variant="dots" size={2} class={styles.dots} />
        <Flow.Background variant="lines" class={styles.lines} />
        <Flow.Background variant="cross" class={styles.cross} />
        <Flow.Viewport>
            <Flow.Nodes>
                {#snippet children(node)}
                    <Flow.Node
                        {node}
                        role="group"
                        aria-label={`${node.data.label}${node.data.done ? ", done" : ""}`}
                        class={styles.node}
                    >
                        {node.data.done ? `✓ ${node.data.label}` : node.data.label}
                        <Flow.Handle type="target" side="left" class={styles.handle} />
                        <Flow.Handle type="source" side="right" class={styles.handle} />
                    </Flow.Node>
                {/snippet}
            </Flow.Nodes>
        </Flow.Viewport>
    </Flow.Root>
    {#if menu}
        <div
            role="menu"
            aria-label="Actions"
            tabindex="-1"
            onkeydown={(event) => {
                if (event.key === "Escape") close();
            }}
            style:left="{menu.at.x}px"
            style:top="{menu.at.y}px"
            class={styles.menu}
        >
            {#if menu.kind === "node"}
                {@const nodeId = menu.nodeId}
                <button
                    bind:this={first}
                    type="button"
                    role="menuitem"
                    onclick={() => duplicate(nodeId)}
                    class={styles.item}
                >
                    Duplicate
                </button>
                <button
                    type="button"
                    role="menuitem"
                    onclick={() => remove([nodeId])}
                    class={styles.danger}
                >
                    Delete
                </button>
            {:else if menu.kind === "selection"}
                {@const nodeIds = menu.nodeIds}
                <button
                    bind:this={first}
                    type="button"
                    role="menuitem"
                    onclick={() => remove(nodeIds)}
                    class={styles.danger}
                >
                    Delete {nodeIds.length} tasks
                </button>
            {:else}
                {@const point = menu.point}
                <button
                    bind:this={first}
                    type="button"
                    role="menuitem"
                    onclick={() => addAt(point)}
                    class={styles.item}
                >
                    Add a task here
                </button>
            {/if}
        </div>
    {/if}
</div>
