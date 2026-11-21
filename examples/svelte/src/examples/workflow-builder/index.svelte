<script module lang="ts">
    import { connection } from "@fragiola/flow-svelte/connection";
    import { drag } from "@fragiola/flow-svelte/drag";
    import { keyboard } from "@fragiola/flow-svelte/keyboard";
    import { minimap } from "@fragiola/flow-svelte/minimap";
    import { reconnection } from "@fragiola/flow-svelte/reconnection";
    import { selection } from "@fragiola/flow-svelte/selection";

    // An automation editor built from the primitives: a palette of typed steps (drag one in, or
    // click it), custom nodes with typed ports, connection rules as a middleware (a refused port
    // turns red while you drag), a condition's two branches labelled on their edges, the inspector
    // of the selected step, a minimap and the zoom controls. The palette and the inspector sit
    // beside the root and work on the same model.

    const features = [
        selection(),
        drag({ snapGrid: [10, 10] }),
        connection(),
        reconnection(),
        keyboard(),
        minimap(),
    ] as const;

    type Features = typeof features;

    let added = 0;
</script>

<script lang="ts">
    import { createFlowModel, type FlowModel, typedFlow, useFlowRef } from "@fragiola/flow-svelte";
    import { MiniMap, MiniMapMask, MiniMapNode } from "@fragiola/flow-svelte/minimap";
    import { MaximizeIcon, MinusIcon, PlusIcon, WorkflowIcon } from "@lucide/svelte";
    import { Badge } from "#/components/atoms/badge";
    import { CATALOG, type CatalogEntry } from "./catalog";
    import { initialWorkflow } from "./data";
    import Inspector from "./inspector.svelte";
    import Palette, { STEP_MIME } from "./palette.svelte";
    import { issuesOf, workflowRules } from "./rules";
    import StepNode from "./step-node.svelte";
    import { styles } from "./styles";
    import type { Types } from "./types";
    import { useWorkflow } from "./use-workflow.svelte.ts";

    const Flow = typedFlow<Types, Features>();

    // the model is made here, once, so that the panels beside the root work on it too
    const model: FlowModel<Types, Features> = createFlowModel<Types, Features>(initialWorkflow, {
        features,
    });
    model.use(workflowRules);
    // every connection is drawn as a smooth step, like the workflow's own
    model.use((ctx, next) => {
        if (ctx.command === "edge.add") {
            ctx.payload = { ...ctx.payload, type: "smoothstep" };
        }
        return next();
    });
    const flow = useFlowRef<Types, Features>();

    // the header's status: how many issues the workflow has left
    const workflow = useWorkflow(model);
    const count = $derived(
        workflow.steps.reduce((sum, step) => sum + issuesOf(step, workflow.edges).length, 0),
    );

    /** Adds a step centred on a client point (a drop's, or the canvas' centre). */
    function addStep(entry: CatalogEntry, client?: { x: number; y: number }): void {
        const current = flow.current;
        if (!current) return;
        const size = current.engine.get("root-size");
        const viewport = current.engine.get("viewport");
        const point = client
            ? current.engine.get("screen-to-flow", client)
            : {
                  x: (size.width / 2 - viewport.x) / viewport.zoom,
                  y: (size.height / 2 - viewport.y) / viewport.zoom,
              };
        added += 1;
        const id = `${entry.id}-${added}`;
        // the new step is centred on the point, and selected so the inspector shows it
        current.model.run("batch", {
            commands: [
                {
                    command: "node.add",
                    payload: entry.create(id, {
                        x: Math.round(point.x - 110),
                        y: Math.round(point.y - 30),
                    }),
                },
                { command: "selection.set", payload: { nodeIds: [id] } },
            ],
        });
    }

    function onDragOver(event: DragEvent): void {
        if (!event.dataTransfer?.types.includes(STEP_MIME)) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = "copy";
    }

    function onDrop(event: DragEvent): void {
        const entry = CATALOG.find((item) => item.id === event.dataTransfer?.getData(STEP_MIME));
        if (!entry) return;
        event.preventDefault();
        addStep(entry, { x: event.clientX, y: event.clientY });
    }
</script>

<div class={styles.app}>
    <header class={styles.header}>
        <span class={styles.logo}>
            <WorkflowIcon />
        </span>
        <div class={styles.headerText}>
            <h1 class={styles.appTitle}>Order follow-up</h1>
            <p class={styles.breadcrumb}>Automations · Draft</p>
        </div>
        <Badge variant="soft" class={styles.statusBadge(count === 0)} data-testid="status">
            {count === 0 ? "Ready" : `${count} issue${count > 1 ? "s" : ""}`}
        </Badge>
        <button type="button" disabled={count > 0} class={styles.publish}>Publish</button>
    </header>
    <Palette onadd={(entry) => addStep(entry)} />
    <Flow.Root
        {model}
        flowRef={flow}
        fitView={{ padding: 0.08, maxZoom: 1 }}
        minZoom={0.3}
        pathOptions={{ borderRadius: 10 }}
        aria-label="Workflow canvas"
        role="group"
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
                    <Flow.Edge
                        {edge}
                        role="group"
                        aria-roledescription="connection"
                        aria-label={`${edge.source} to ${edge.target}`}
                        class={styles.edgeGroup}
                    >
                        <Flow.EdgePath class={styles.edgeHit} />
                        <Flow.EdgePath class={styles.edge} />
                        <!-- a condition's outputs are its branches: the edge says which it leaves by -->
                        {#if edge.sourceHandle === "yes" || edge.sourceHandle === "no"}
                            <Flow.EdgeLabel class={styles.branchLabel(edge.sourceHandle)}>
                                {edge.sourceHandle}
                            </Flow.EdgeLabel>
                        {/if}
                    </Flow.Edge>
                {/snippet}
            </Flow.Edges>
            <Flow.Nodes>
                {#snippet children(node)}
                    <StepNode step={node} />
                {/snippet}
            </Flow.Nodes>
            <Flow.ConnectionLine class={styles.connection} />
        </Flow.Viewport>
        <Flow.SelectionBox class={styles.box} />
        <Flow.Controls role="group" aria-label="Zoom" class={styles.controls}>
            <Flow.ZoomIn aria-label="Zoom in" class={styles.control}>
                <PlusIcon />
            </Flow.ZoomIn>
            <Flow.ZoomOut aria-label="Zoom out" class={styles.control}>
                <MinusIcon />
            </Flow.ZoomOut>
            <Flow.FitView aria-label="Fit view" class={styles.control}>
                <MaximizeIcon />
            </Flow.FitView>
        </Flow.Controls>
        <MiniMap
            width={120}
            height={84}
            role="img"
            aria-label="Minimap of the workflow"
            class={styles.minimap}
        >
            {#snippet children(view)}
                {#each view.nodes as item (item.nodeId)}
                    <MiniMapNode nodeId={item.nodeId} class={styles.minimapNode} />
                {/each}
                <MiniMapMask class={styles.minimapMask} />
            {/snippet}
        </MiniMap>
    </Flow.Root>
    <Inspector {model} />
</div>
