<script module lang="ts">
    import type { FlowNodeInput, FlowTypes } from "@fragiola/flow-svelte";
    import { connection } from "@fragiola/flow-svelte/connection";
    import { drag } from "@fragiola/flow-svelte/drag";
    import { selection } from "@fragiola/flow-svelte/selection";
    import { CircleIcon, DiamondIcon, SquareIcon } from "@lucide/svelte";

    // Adding nodes from outside the flow. The palette's items are dragged with the browser's own
    // drag and drop: the root accepts the drop, and `engine.get("screen-to-flow", { x, y })` turns
    // the drop's client point into flow coordinates, where `node.add` puts the node. A click on an
    // item adds one at the centre of the view instead. `useFlowRef` (given as `flowRef`) reaches
    // the model and the engine from outside the root.

    const SHAPES = [
        { shape: "circle", label: "Start", icon: CircleIcon },
        { shape: "square", label: "Task", icon: SquareIcon },
        { shape: "diamond", label: "Decision", icon: DiamondIcon },
    ] as const;

    type Shape = (typeof SHAPES)[number]["shape"];

    interface Types extends FlowTypes {
        readonly nodes: { shape: { shape: Shape; label: string } };
    }

    const features = [selection(), drag(), connection()] as const;

    const MIME = "application/x-flow-shape";

    const nodes: FlowNodeInput<Types>[] = [
        {
            id: "first",
            type: "shape",
            position: { x: 0, y: 0 },
            data: { shape: "circle", label: "Start" },
        },
    ];

    let count = 0;
</script>

<script lang="ts">
    import { typedFlow, useFlowRef } from "@fragiola/flow-svelte";
    import { styles } from "./styles";

    const Flow = typedFlow<Types, typeof features>();
    const flow = useFlowRef<Types, typeof features>();

    /** Adds a node centred on a client point (a drop's, or the view's centre). */
    function addAt(shape: Shape, client: { x: number; y: number }): void {
        const current = flow.current;
        if (!current) return;
        const point = current.engine.get("screen-to-flow", client);
        const label = SHAPES.find((item) => item.shape === shape)?.label ?? shape;
        count += 1;
        current.model.run("node.add", {
            id: `${shape}-${count}`,
            type: "shape",
            // the node's top-left corner, so that its middle lands on the point
            position: { x: point.x - 50, y: point.y - 20 },
            data: { shape, label: `${label} ${count}` },
        });
    }

    function addAtCentre(shape: Shape, event: MouseEvent): void {
        const button = event.currentTarget as HTMLElement;
        const root = button
            .closest("[data-testid=add-nodes]")
            ?.querySelector('[data-flow-part="root"]');
        const box = root?.getBoundingClientRect();
        if (box) {
            addAt(shape, {
                x: box.x + box.width / 2,
                y: box.y + box.height / 2,
            });
        }
    }

    function onDragStart(shape: Shape, event: DragEvent): void {
        if (!event.dataTransfer) return;
        event.dataTransfer.setData(MIME, shape);
        event.dataTransfer.effectAllowed = "copy";
    }

    function onDragOver(event: DragEvent): void {
        if (!event.dataTransfer?.types.includes(MIME)) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = "copy";
    }

    function onDrop(event: DragEvent): void {
        const shape = event.dataTransfer?.getData(MIME) as Shape;
        if (!SHAPES.some((item) => item.shape === shape)) return;
        event.preventDefault();
        addAt(shape, { x: event.clientX, y: event.clientY });
    }
</script>

<div data-testid="add-nodes" class={styles.layout}>
    <aside aria-label="Node palette" class={styles.palette}>
        <p class={styles.paletteTitle}>Drag or click</p>
        {#each SHAPES as { shape, label, icon: Icon } (shape)}
            <button
                type="button"
                draggable="true"
                class={styles.item}
                ondragstart={(event) => onDragStart(shape, event)}
                onclick={(event) => addAtCentre(shape, event)}
            >
                <Icon />
                {label}
            </button>
        {/each}
    </aside>
    <Flow.Root
        {features}
        defaultNodes={nodes}
        defaultViewport={{ x: 160, y: 80, zoom: 1 }}
        flowRef={flow}
        class={styles.root}
        ondragover={onDragOver}
        ondrop={onDrop}
    >
        <Flow.Background variant="dots" size={2} class={styles.dots} />
        <Flow.Background variant="lines" class={styles.lines} />
        <Flow.Background variant="cross" class={styles.cross} />
        <Flow.Viewport>
            <Flow.Edges>
                {#snippet children(edge)}
                    <Flow.Edge {edge}>
                        <Flow.EdgePath class={styles.edge} />
                    </Flow.Edge>
                {/snippet}
            </Flow.Edges>
            <Flow.Nodes>
                {#snippet children(node)}
                    <Flow.Node {node} class={styles.shape(node.data.shape)}>
                        {node.data.label}
                        <Flow.Handle type="target" side="top" class={styles.handle} />
                        <Flow.Handle type="source" side="bottom" class={styles.handle} />
                    </Flow.Node>
                {/snippet}
            </Flow.Nodes>
            <Flow.ConnectionLine class={styles.connection} />
        </Flow.Viewport>
    </Flow.Root>
</div>
