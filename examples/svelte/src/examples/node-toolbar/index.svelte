<script module lang="ts">
    import type { FlowNodeInput, FlowTypes } from "@fragiola/flow-svelte";
    import { drag } from "@fragiola/flow-svelte/drag";
    import { selection } from "@fragiola/flow-svelte/selection";

    // `Flow.NodeToolbar` stands next to its node, outside the zoom: it keeps its size whatever the
    // zoom, and shows while its node is selected (or as `open` says). Its buttons run commands:
    // duplicate (`node.add` with a new id), recolour (`node.set-data`) and delete (`node.remove`),
    // in toolbar.svelte. With `nodeIds` it stands beside several nodes' bounds: Shift-click a
    // second note, and the selection's toolbar below them (selection-toolbar.svelte) recolours or
    // deletes them all.

    export const TONES = ["blue", "green", "orange", "purple"] as const;
    export type Tone = (typeof TONES)[number];

    export interface Types extends FlowTypes {
        readonly nodes: { sticky: { text: string; tone: Tone } };
    }

    export const features = [selection(), drag()] as const;

    const nodes: FlowNodeInput<Types>[] = [
        {
            id: "idea",
            type: "sticky",
            position: { x: 0, y: 0 },
            selected: true,
            data: { text: "Select a note", tone: "blue" },
        },
        {
            id: "todo",
            type: "sticky",
            position: { x: 220, y: 60 },
            data: { text: "Then use its toolbar", tone: "orange" },
        },
    ];
</script>

<script lang="ts">
    import { typedFlow } from "@fragiola/flow-svelte";
    import { styles } from "./styles";
    import SelectionToolbar from "./selection-toolbar.svelte";
    import Toolbar from "./toolbar.svelte";

    const Flow = typedFlow<Types, typeof features>();
</script>

<Flow.Root
    {features}
    defaultNodes={nodes}
    fitView={{ padding: 0.2, maxZoom: 1 }}
    class={styles.root}
>
    <Flow.Background variant="dots" size={2} class={styles.dots} />
    <Flow.Background variant="lines" class={styles.lines} />
    <Flow.Background variant="cross" class={styles.cross} />
    <Flow.Viewport>
        <Flow.Nodes>
            {#snippet children(node)}
                <Flow.Node {node} class={styles.sticky(node.data.tone)}>
                    {node.data.text}
                    <Toolbar {node} />
                </Flow.Node>
            {/snippet}
        </Flow.Nodes>
    </Flow.Viewport>
    <SelectionToolbar />
</Flow.Root>
