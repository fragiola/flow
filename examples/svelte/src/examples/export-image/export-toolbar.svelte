<!-- The toolbar: the two downloads and what the last one did. -->
<script lang="ts">
    import { useFlow } from "@fragiola/flow-svelte";
    import { FileCodeIcon, ImageIcon } from "@lucide/svelte";
    import { downloadBlob, lookOf, pngOf, svgBlob } from "./download";
    import { flowSvg } from "./flow-svg";
    import type { features, Types } from "./index.svelte";
    import { styles } from "./styles";

    const flow = useFlow<Types, typeof features>();
    let message = $state("Drag the nodes, then download the flow.");
    // a PNG still drawing when the toolbar goes away is not saved
    let destroyed = false;
    $effect(() => () => {
        destroyed = true;
    });

    /** The SVG of the document as it is now, in the look of the page's theme. */
    function svgFrom(event: MouseEvent & { currentTarget: HTMLButtonElement }) {
        const root = event.currentTarget.closest('[data-flow-part="root"]');
        const json = flow.model.get("flow-json");
        const svg = flowSvg(json, { look: root ? lookOf(root) : {} });
        return {
            svg,
            counts: `${json.nodes.length} nodes, ${json.edges.length} edges`,
        };
    }

    function onSvg(event: MouseEvent & { currentTarget: HTMLButtonElement }) {
        const { svg, counts } = svgFrom(event);
        downloadBlob(svgBlob(svg.markup), "flow.svg");
        message = `Downloaded flow.svg (${counts}).`;
    }

    async function onPng(event: MouseEvent & { currentTarget: HTMLButtonElement }) {
        const { svg, counts } = svgFrom(event);
        try {
            const png = await pngOf(svg);
            if (destroyed) return;
            downloadBlob(png, "flow.png");
            message = `Downloaded flow.png (${counts}).`;
        } catch {
            if (!destroyed) message = "This browser could not draw the PNG.";
        }
    }
</script>

<div role="toolbar" aria-label="Export" data-flow-no-gesture="" class={styles.panel}>
    <button type="button" onclick={onSvg} class={styles.primary}>
        <FileCodeIcon />
        Download SVG
    </button>
    <button type="button" onclick={onPng} class={styles.button}>
        <ImageIcon />
        Download PNG
    </button>
    <p role="status" data-testid="message" class={styles.message}>
        {message}
    </p>
</div>
