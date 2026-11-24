<script module lang="ts">
    import type { Side } from "./rotation";

    /** Where a handle sits on the node's unturned content: the middle of its side. */
    const PLACE: Record<Side, Record<string, string | number>> = {
        top: { top: 0, left: "50%", transform: "translate(-50%, -50%)" },
        right: { top: "50%", left: "100%", transform: "translate(-50%, -50%)" },
        bottom: { top: "100%", left: "50%", transform: "translate(-50%, -50%)" },
        left: { top: "50%", left: 0, transform: "translate(-50%, -50%)" },
    };
</script>

<script lang="ts">
    import { Flow } from "@fragiola/flow-svelte";
    import { NodeResizer, RESIZE_POSITIONS, ResizeHandle } from "@fragiola/flow-svelte/resize";
    import type { Node } from "./index.svelte";
    import RotateHandle from "./rotate-handle.svelte";
    import { rotatedSide } from "./rotation";
    import ShapeLabel from "./shape-label.svelte";
    import { shapePath } from "./shape-path";
    import ShapePicker from "./shape-picker.svelte";
    import { styles } from "./styles";

    // A node's content: its shape's outline, its label, the rotation knob and the two handles, all
    // turned by the node's angle; then its resizer and its toolbar, which do not turn.

    let {
        node,
        editing,
        onediting,
    }: { node: Node; editing: boolean; onediting: (on: boolean) => void } = $props();

    let frame = $state<HTMLDivElement | null>(null);
    const width = $derived(node.width ?? 140);
    const height = $derived(node.height ?? 64);
</script>

<div
    bind:this={frame}
    data-shape={node.data.shape}
    data-angle={node.data.angle}
    style:transform="rotate({node.data.angle}deg)"
    class={styles.frame}
>
    <svg viewBox="0 0 {width} {height}" aria-hidden="true" class={styles.svg}>
        <path d={shapePath(node.data.shape, width, height, 1.5)} class={styles.outline} />
    </svg>
    <ShapeLabel {node} {editing} {onediting} />
    <RotateHandle {node} frame={() => frame} />
    <!-- remounted on a turn: measured again where the turn put it -->
    {#key node.data.angle}
        <Flow.Handle
            type="target"
            side={rotatedSide("top", node.data.angle)}
            aria-label={`${node.data.label} input`}
            style={PLACE.top}
            class={styles.handle}
        />
        <Flow.Handle
            type="source"
            side={rotatedSide("bottom", node.data.angle)}
            aria-label={`${node.data.label} output`}
            style={PLACE.bottom}
            class={styles.handle}
        />
    {/key}
</div>
<NodeResizer class={styles.resizer}>
    {#each RESIZE_POSITIONS as position (position)}
        <ResizeHandle
            {position}
            aria-label={`Resize ${node.data.label}: ${position}`}
            class={styles.resizeHandle}
        />
    {/each}
</NodeResizer>
<ShapePicker {node} onedit={() => onediting(true)} />
