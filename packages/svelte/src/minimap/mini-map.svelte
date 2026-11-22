<script module lang="ts">
    import type { MinimapView, XY } from "@fragiola/flow";
    import type { Snippet } from "svelte";
    import type { SvgPrimitiveProps } from "../utils/render.js";

    export interface MiniMapState {
        /** what it draws: the nodes, the view and the mask, in flow coordinates */
        readonly view: MinimapView;
    }

    export interface MiniMapProps
        extends Omit<
            SvgPrimitiveProps<MiniMapState, SVGSVGElement>,
            "children" | "width" | "height" | "onclick"
        > {
        /** its width, in pixels; default 200 */
        width?: number | undefined;
        /** its height, in pixels; default 150 */
        height?: number | undefined;
        /**
         * a drag on it moves the view the other way (as grabbing the flow), and a press does not
         * centre the view; default `minimap()`'s `inversePan`
         */
        inversePan?: boolean | undefined;
        /** how fast its wheel zooms: 10 is the flow's own wheel, 20 twice as fast; default `minimap()`'s `zoomStep` */
        zoomStep?: number | undefined;
        /**
         * a tap on it (`minimap-click`), with the flow point under the pointer on the minimap: center
         * the view there, add a node there
         */
        onclick?: ((event: MouseEvent, point: XY) => void) | undefined;
        /**
         * what it draws, in flow coordinates (`{#snippet children(view)}`); default a
         * `MiniMapNode` per node, then the `MiniMapMask`
         */
        children?: Snippet<[MinimapView]> | undefined;
    }

    const EMPTY_VIEW: MinimapView = Object.freeze({
        viewBox: Object.freeze({ x: 0, y: 0, width: 0, height: 0 }),
        viewBoxAttribute: "0 0 0 0",
        scale: 1,
        nodes: Object.freeze([]),
        view: Object.freeze({ x: 0, y: 0, width: 0, height: 0 }),
        maskPath: "",
    });

    function sameView(a: MinimapView, b: MinimapView): boolean {
        return (
            a === b ||
            (a.viewBoxAttribute === b.viewBoxAttribute &&
                a.maskPath === b.maskPath &&
                a.nodes.length === b.nodes.length &&
                a.nodes.every((node, i) => {
                    const other = b.nodes[i];
                    return (
                        other !== undefined &&
                        node.nodeId === other.nodeId &&
                        node.x === other.x &&
                        node.y === other.y &&
                        node.width === other.width &&
                        node.height === other.height
                    );
                }))
        );
    }
</script>

<!--
    @component
    A small map of the flow (`data-flow-part="minimap"`, `minimap()`): an SVG of `width` × `height`
    pixels showing every node and what the root shows. With `minimap()`'s options, a drag on it pans
    and its wheel zooms the flow. Inside `Flow.Root`, outside `Flow.Viewport`; place it with your
    style.
-->
<script lang="ts">
    import { partAttributes } from "@fragiola/flow";
    import { useFlowContext } from "../context.js";
    import { flowValue } from "../runes/internal.svelte.js";
    import {
        elementProps,
        px,
        refProps,
        type RenderedProps,
    } from "../utils/render.js";
    import { setMiniMapContext } from "./mini-map-context.js";
    import MiniMapMask from "./mini-map-mask.svelte";
    import MiniMapNode from "./mini-map-node.svelte";

    let {
        width = 200,
        height = 150,
        inversePan,
        zoomStep,
        onclick,
        children,
        render,
        class: className,
        style,
        ref = $bindable(),
        ...rest
    }: MiniMapProps = $props();

    const context = useFlowContext("MiniMap");
    // its options over `minimap()`'s, one set for the root's minimaps (the engine's part options)
    $effect(() => {
        const engine = context.engine;
        const options = Object.fromEntries(
            Object.entries({ inversePan, zoomStep }).filter(
                ([, value]) => value !== undefined,
            ),
        );
        if (!engine) return;
        engine.adapter.setPartOptions("minimap", "", options);
        return () => engine.adapter.setPartOptions("minimap", "", null);
    });
    // its tap: the engine's `minimap-click` (the root captures the pointer, no DOM click comes)
    $effect(() => {
        const engine = context.engine;
        if (!engine) return;
        return engine.subscribe((event) => {
            if (event.type === "minimap-click") {
                onclick?.(event.event, event.point);
            }
        });
    });
    const view = flowValue(
        context,
        () =>
            context.engine?.get("minimap-view", { width, height }) ??
            EMPTY_VIEW,
        sameView,
    );
    const attributes = flowValue(context, () =>
        context.engine
            ? context.engine.adapter.attributes("minimap")
            : partAttributes("minimap"),
    );
    setMiniMapContext({
        get view() {
            return view.current;
        },
    });
    const refs = refProps((element) => {
        ref = element as SVGSVGElement | null;
    });
    const partState = $derived<MiniMapState>({ view: view.current });
    const attrs: RenderedProps<SVGSVGElement> = $derived(
        elementProps({
            rest,
            className,
            style,
            state: partState,
            own: {
                ...attributes.current,
                viewBox: view.current.viewBoxAttribute,
                width,
                height,
                ...refs,
            },
            structural: { width: px(width), height: px(height) },
        }),
    );
</script>

{#snippet content()}
    {#if children}
        {@render children(view.current)}
    {:else}
        {#each view.current.nodes as node (node.nodeId)}
            <MiniMapNode nodeId={node.nodeId} />
        {/each}
        <MiniMapMask />
    {/if}
{/snippet}

{#if render}
    {@render render({ props: attrs as never, state: partState, children: content })}
{:else}
    <svg {...attrs}>{@render content()}</svg>
{/if}
