<script module lang="ts">
    import type { FlowEdgeInput, FlowNodeInput, FlowTypes } from "@fragiola/flow-svelte";
    import { drag } from "@fragiola/flow-svelte/drag";
    import { keyboard } from "@fragiola/flow-svelte/keyboard";
    import { selection } from "@fragiola/flow-svelte/selection";
    import {
        BellRingIcon,
        BracesIcon,
        DatabaseIcon,
        FileTextIcon,
        ShieldCheckIcon,
    } from "@lucide/svelte";
    import type { Component } from "svelte";
    import type { Kind } from "./gradients";

    // A look of the app's own, every colour a palette's accent so it follows the five themes. A node's
    // border is a gradient between two palettes (its kind's, `gradients.ts`): the node sits in the
    // first, a frame inside it in the second, and the frame paints the gradient around the body.
    // Selected (`data-selected`), the node glows in its own colour. An edge's stroke is an SVG
    // `<linearGradient>` of its own (gradient-edge.svelte), from its source's colour to its target's:
    // drawn in flow coordinates (`userSpaceOnUse`) between the edge's ends (`useEdge(edge).state.path`),
    // so it keeps its direction while a node moves, and a straight edge (whose box has no height) still
    // paints. Its id starts with `$props.id()`, so two of these flows on one page never share one.

    export interface Types extends FlowTypes {
        readonly nodes: {
            step: { label: string; kind: Kind; detail: string };
        };
    }

    export const features = [selection(), drag(), keyboard()] as const;

    const step = (
        id: string,
        label: string,
        kind: Kind,
        detail: string,
        x: number,
        y: number,
    ) => ({
        id,
        type: "step" as const,
        position: { x, y },
        data: { label, kind, detail },
    });

    const nodes: FlowNodeInput<Types>[] = [
        step("events", "Events", "source", "events.ndjson", 0, 120),
        step("parse", "Parse", "transform", "JSON lines to rows", 300, 120),
        step("validate", "Validate", "check", "against the schema", 600, 120),
        step("report", "Report", "output", "daily summary", 900, 20),
        step("alerts", "Alerts", "output", "on rejected rows", 900, 220),
    ];

    const ICONS: Record<string, Component> = {
        events: DatabaseIcon,
        parse: BracesIcon,
        validate: ShieldCheckIcon,
        report: FileTextIcon,
        alerts: BellRingIcon,
    };

    /** A node's icon, by its id. */
    const iconOf = (nodeId: string) => ICONS[nodeId] ?? BracesIcon;

    const link = (source: string, target: string) => ({
        id: `${source}-${target}`,
        source,
        target,
    });

    const edges: FlowEdgeInput<Types>[] = [
        link("events", "parse"),
        link("parse", "validate"),
        link("validate", "report"),
        link("validate", "alerts"),
    ];

    /** Each step's data, by node id: what an edge names and colours itself by. */
    export const STEPS = Object.fromEntries(nodes.map((node) => [node.id, node.data]));
</script>

<script lang="ts">
    import { typedFlow } from "@fragiola/flow-svelte";
    import GradientEdge from "./gradient-edge.svelte";
    import { describeStep, idPrefix } from "./gradients";
    import { styles } from "./styles";

    const Flow = typedFlow<Types, typeof features>();
    const uid = $props.id();
    const prefix = idPrefix(uid);
</script>

<Flow.Root
    {features}
    defaultNodes={nodes}
    defaultEdges={edges}
    fitView={{ padding: 0.15, maxZoom: 1 }}
    role="group"
    aria-label="Gradient styling"
    class={styles.root}
>
    <Flow.Background variant="dots" size={2} class={styles.dots} />
    <Flow.Background variant="lines" class={styles.lines} />
    <Flow.Background variant="cross" class={styles.cross} />
    <Flow.Viewport>
        <Flow.Edges>
            {#snippet children(edge)}
                <GradientEdge {edge} {prefix} />
            {/snippet}
        </Flow.Edges>
        <Flow.Nodes>
            {#snippet children(node)}
                {@const Icon = iconOf(node.id)}
                <Flow.Node
                    {node}
                    role="group"
                    aria-roledescription="node"
                    aria-label={describeStep(node.data.label, node.data.kind, node.data.detail)}
                    class={styles.node(node.data.kind)}
                >
                    <Flow.Handle type="target" side="left" class={styles.handle} />
                    <div class={styles.frame(node.data.kind)}>
                        <div class={styles.body}>
                            <span class={styles.icon}>
                                <Icon />
                            </span>
                            <span class={styles.text}>
                                <span class={styles.title}>{node.data.label}</span>
                                <span class={styles.detail}>{node.data.detail}</span>
                            </span>
                        </div>
                    </div>
                    <Flow.Handle type="source" side="right" class={styles.handle} />
                </Flow.Node>
            {/snippet}
        </Flow.Nodes>
    </Flow.Viewport>
</Flow.Root>
