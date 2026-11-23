<script setup lang="ts">
import { useFlow } from "@fragiola/flow-vue";
import { FileCodeIcon, ImageIcon } from "@lucide/vue";
import { shallowRef } from "vue";
import { downloadBlob, lookOf, pngOf, svgBlob } from "./download";
import { flowSvg } from "./flow-svg";
import type { features, Types } from "./index.vue";
import { styles } from "./styles";

// The toolbar: the two downloads and what the last one did.

const { model } = useFlow<Types, typeof features>();
const message = shallowRef("Drag the nodes, then download the flow.");

/** The SVG of the document as it is now, in the look of the page's theme. */
function svgFrom(event: MouseEvent) {
    const target = event.currentTarget as HTMLElement;
    const root = target.closest('[data-flow-part="root"]');
    const flow = model.get("flow-json");
    const svg = flowSvg(flow, { look: root ? lookOf(root) : {} });
    return {
        svg,
        counts: `${flow.nodes.length} nodes, ${flow.edges.length} edges`,
    };
}

function onSvg(event: MouseEvent) {
    const { svg, counts } = svgFrom(event);
    downloadBlob(svgBlob(svg.markup), "flow.svg");
    message.value = `Downloaded flow.svg (${counts}).`;
}

async function onPng(event: MouseEvent) {
    const { svg, counts } = svgFrom(event);
    try {
        downloadBlob(await pngOf(svg), "flow.png");
        message.value = `Downloaded flow.png (${counts}).`;
    } catch {
        message.value = "This browser could not draw the PNG.";
    }
}
</script>

<template>
    <div
        role="toolbar"
        aria-label="Export"
        data-flow-no-gesture=""
        :class="styles.panel"
    >
        <button type="button" :class="styles.primary" @click="onSvg">
            <FileCodeIcon />
            Download SVG
        </button>
        <button type="button" :class="styles.button" @click="onPng">
            <ImageIcon />
            Download PNG
        </button>
        <p role="status" data-testid="message" :class="styles.message">
            {{ message }}
        </p>
    </div>
</template>
