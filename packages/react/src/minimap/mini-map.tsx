import { type MinimapView, partAttributes, type XY } from "@fragiola/flow";
import * as React from "react";
import { useFlowContext } from "../context";
import { useFlowValue, useIsomorphicLayoutEffect } from "../hooks/internal";
import { type SvgPrimitiveProps, useRenderElement } from "../utils/use-render";
import { MiniMapContext } from "./mini-map-context";
import { MiniMapMask } from "./mini-map-mask";
import { MiniMapNode } from "./mini-map-node";

export interface MiniMapState {
    /** what it draws: the nodes, the view and the mask, in flow coordinates */
    readonly view: MinimapView;
}

export interface MiniMapProps
    extends Omit<
        SvgPrimitiveProps<MiniMapState, SVGSVGElement>,
        "children" | "onClick"
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
    onClick?: ((event: MouseEvent, point: XY) => void) | undefined;
    /**
     * what it draws, in flow coordinates; default a `MiniMapNode` per node, then the `MiniMapMask`
     */
    children?: React.ReactNode | ((view: MinimapView) => React.ReactNode);
}

const EMPTY_VIEW: MinimapView = Object.freeze({
    viewBox: Object.freeze({ x: 0, y: 0, width: 0, height: 0 }),
    viewBoxAttribute: "0 0 0 0",
    scale: 1,
    nodes: Object.freeze([]),
    view: Object.freeze({ x: 0, y: 0, width: 0, height: 0 }),
    maskPath: "",
});

/**
 * A small map of the flow (`data-flow-part="minimap"`, `minimap()`): an SVG of `width` × `height`
 * pixels showing every node and what the root shows. With `minimap()`'s options, a drag on it pans
 * and its wheel zooms the flow. Inside `Flow.Root`, outside `Flow.Viewport`; place it with your
 * style.
 */
export function MiniMap(props: MiniMapProps) {
    const {
        width = 200,
        height = 150,
        inversePan,
        zoomStep,
        onClick,
        children,
        ...rest
    } = props;
    const { model, engine } = useFlowContext("MiniMap");
    // its options over `minimap()`'s, one set for the root's minimaps (the engine's part options)
    useIsomorphicLayoutEffect(() => {
        if (!engine) return;
        const options = Object.fromEntries(
            Object.entries({ inversePan, zoomStep }).filter(
                ([, value]) => value !== undefined,
            ),
        );
        engine.adapter.setPartOptions("minimap", "", options);
        return () => engine.adapter.setPartOptions("minimap", "", null);
    }, [engine, inversePan, zoomStep]);
    const latestClick = React.useRef(onClick);
    latestClick.current = onClick;
    // its own element: the root may draw several minimaps, each keeps only its taps
    const own = React.useRef<SVGSVGElement | null>(null);
    React.useEffect(() => {
        if (!engine) return;
        return engine.subscribe((event) => {
            if (
                event.type === "minimap-click" &&
                event.element === own.current
            ) {
                latestClick.current?.(event.event, event.point);
            }
        });
    }, [engine]);
    const view = useFlowValue(
        model,
        engine,
        () => engine?.get("minimap-view", { width, height }) ?? EMPTY_VIEW,
        (a, b) =>
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
                })),
    );
    const attributes = useFlowValue(model, engine, () =>
        engine
            ? engine.adapter.attributes("minimap")
            : partAttributes("minimap"),
    );
    const content =
        typeof children === "function"
            ? children(view)
            : (children ?? (
                  <>
                      {view.nodes.map((node) => (
                          <MiniMapNode key={node.nodeId} nodeId={node.nodeId} />
                      ))}
                      <MiniMapMask />
                  </>
              ));
    const element = useRenderElement("svg", rest, {
        ref: own,
        state: { view },
        props: {
            ...attributes,
            viewBox: view.viewBoxAttribute,
            width,
            height,
            children: content,
        },
        style: { width, height },
    });
    return (
        <MiniMapContext.Provider value={view}>
            {element}
        </MiniMapContext.Provider>
    );
}
