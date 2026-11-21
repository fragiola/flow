import { type MinimapView, partAttributes } from "@fragiola/flow";
import type * as React from "react";
import { useFlowContext } from "../context";
import { useFlowValue } from "../hooks/internal";
import { type SvgPrimitiveProps, useRenderElement } from "../utils/use-render";
import { MiniMapContext } from "./mini-map-context";
import { MiniMapMask } from "./mini-map-mask";
import { MiniMapNode } from "./mini-map-node";

export interface MiniMapState {
    /** what it draws: the nodes, the view and the mask, in flow coordinates */
    readonly view: MinimapView;
}

export interface MiniMapProps
    extends Omit<SvgPrimitiveProps<MiniMapState, SVGSVGElement>, "children"> {
    /** its width, in pixels; default 200 */
    width?: number | undefined;
    /** its height, in pixels; default 150 */
    height?: number | undefined;
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
    const { width = 200, height = 150, children, ...rest } = props;
    const { model, engine } = useFlowContext("MiniMap");
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
