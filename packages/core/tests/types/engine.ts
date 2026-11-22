// Type fixtures (compiled by `pnpm typecheck`, never run): the engine's typed surface, its keys
// typed by the installed features, its adapter's attributes by part.
import { connection } from "../../src/connection/connection";
import { drag } from "../../src/drag/drag";
import type { FlowEngineAdapter } from "../../src/engine/adapter";
import {
    createFlowEngine,
    type FlowEngine,
} from "../../src/engine/create-flow-engine";
import type { Connection } from "../../src/engine/verbs";
import type { EdgePath, Viewport } from "../../src/geometry/types";
import { minimap } from "../../src/minimap/minimap";
import { createFlowModel } from "../../src/model/create-flow-model";

function use(_value: unknown): void {}

/** `true` when `A` and `B` are the same union. */
type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;

// the engine's whole surface: the verbs, subscribe, destroy and adapter (a new member on purpose)
export const engineSurface: Same<
    keyof FlowEngine,
    "run" | "can" | "check" | "get" | "is" | "subscribe" | "destroy" | "adapter"
> = true;

export const adapterSurface: Same<
    keyof FlowEngineAdapter,
    | "model"
    | "settings"
    | "attachRoot"
    | "detachRoot"
    | "attachViewport"
    | "registerNode"
    | "setOptions"
    | "registerHandle"
    | "setPartOptions"
    | "attributes"
    | "subscribe"
    | "getSnapshot"
> = true;

export function coreKeys(): void {
    const engine = createFlowEngine(createFlowModel());
    const viewport: Viewport = engine.get("viewport");
    const path: EdgePath | undefined = engine.get("edge-path-by", {
        edgeId: "e",
    });
    use([viewport, path]);
    engine.run("fit-view");
    engine.run("fit-view", { padding: 0.2, nodeIds: ["a"] });
    engine.run("zoom-in");
    engine.run("zoom-in", { duration: 300 });
    engine.run("set-viewport", { x: 0, duration: 200 });
    engine.run("zoom-to", { zoom: 1, duration: 200 });
    engine.run("fit-view", { duration: 400 });
    engine.run("center-on", { x: 0, y: 0, duration: 200 });
    engine.adapter.setOptions({
        autoPan: { speed: 12, margin: 40 },
        panOnDrag: [1, 2],
        panActivationKey: " ",
        panOnScrollMode: "vertical",
        panOnScrollSpeed: 0.5,
        zoomActivationKey: null,
        easing: (t) => t,
    });
    createFlowEngine(createFlowModel(), { autoPan: false, panOnDrag: true });
    const near: readonly { id: string }[] = engine.get("intersecting-nodes", {
        nodeId: "a",
        partial: false,
    });
    const framed: Viewport | undefined = engine.get("viewport-for-bounds", {
        bounds: { x: 0, y: 0, width: 10, height: 10 },
        padding: 0.2,
    });
    use([
        near,
        framed,
        engine.get("intersecting-nodes", {
            rect: { x: 0, y: 0, width: 1, height: 1 },
        }),
        engine.get("edge-toolbar-by", {
            edgeId: "e",
            position: "source",
            offset: { x: 0, y: -8 },
        })?.anchorX,
        engine.get("node-toolbar-by", { nodeIds: ["a", "b"], side: "bottom" }),
        engine.get("node-toolbar-by", { nodeId: "a" }),
    ]);
    // @ts-expect-error a toolbar stands at the label or an end
    engine.get("edge-toolbar-by", { edgeId: "e", position: "middle" });
    // @ts-expect-error viewport-for-bounds needs its bounds
    engine.get("viewport-for-bounds", { padding: 0 });
    // @ts-expect-error a duration is a number of milliseconds
    engine.run("zoom-out", { duration: "fast" });
    // @ts-expect-error not a scroll mode
    engine.adapter.setOptions({ panOnScrollMode: "diagonal" });
    // @ts-expect-error pan-by takes both offsets
    engine.run("pan-by", { x: 1 });
    // @ts-expect-error a command is the model's, not an action
    engine.run("node.move", { nodeId: "a", position: { x: 0, y: 0 } });
    // @ts-expect-error `connection` is the connection feature's
    engine.get("connection");
    // @ts-expect-error `dragging` is the drag feature's
    engine.is("dragging");
    // @ts-expect-error `minimap-view` is the minimap feature's
    engine.get("minimap-view", { width: 1, height: 1 });
}

export function featureKeys(): void {
    const features = [connection(), drag(), minimap()] as const;
    const engine = createFlowEngine(createFlowModel(undefined, { features }));
    const current: Connection | null = engine.get("connection");
    use(current);
    use(engine.is("dragging"));
    use(engine.is("node-dragging", { nodeId: "a" }));
    use(engine.get("minimap-view", { width: 200, height: 150 }).viewBox);
    // @ts-expect-error the selection box is the selection feature's
    engine.get("selection-box");
}

export function attributes(engine: FlowEngine): void {
    use(engine.adapter.attributes("node", { nodeId: "a" }));
    use(engine.adapter.attributes("viewport"));
    use(
        engine.adapter.attributes("handle", {
            nodeId: "a",
            type: "source",
            side: "right",
        }),
    );
    // @ts-expect-error a node's attributes need its id
    engine.adapter.attributes("node");
}
