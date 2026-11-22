// Type fixtures (compiled by `pnpm typecheck`, never run): the model's typed surface, typed by the
// app's registry and by the installed features.
import { veto } from "../../src/commands/veto";
import { connection } from "../../src/connection/connection";
import type { AnyTypes, FlowEdge, FlowJson } from "../../src/document/types";
import {
    createFlowModel,
    type FlowModel,
} from "../../src/model/create-flow-model";
import { reconnection } from "../../src/reconnection/reconnection";
import { selection } from "../../src/selection/selection";
import { subflows } from "../../src/subflows/subflows";

function use(_value: unknown): void {}

/** `true` when `A` and `B` are the same union. */
type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;

// the model's whole surface: one verb per member (a new member must be added here on purpose)
export const modelSurface: Same<
    keyof FlowModel,
    "run" | "dispatch" | "can" | "check" | "get" | "is" | "use" | "subscribe"
> = true;

// an `any` registry (what Angular's template check gives a generic directive from a package) takes
// every edge type, as `AnyTypes` does, not only the built-in ones (#17)
// biome-ignore lint/suspicious/noExplicitAny: the registry Angular's template check gives
export const anyEdges: Same<FlowEdge<any>, FlowEdge<AnyTypes>> = true;

interface Types {
    nodes: { task: { title: string; done: boolean }; note: { text: string } };
    edges: { dependency: { weight: number } };
}

declare const json: FlowJson<Types>;

export function typedData(): void {
    const model = createFlowModel<Types>(json);
    model.run("node.add", {
        type: "task",
        position: { x: 0, y: 0 },
        data: { title: "a", done: false },
    });
    model.run("node.add", {
        type: "note",
        position: { x: 0, y: 0 },
        // @ts-expect-error: a note's data is { text }
        data: { title: "a" },
    });
    const other = {
        type: "other",
        position: { x: 0, y: 0 },
        data: {},
    } as const;
    // @ts-expect-error: not a node type of the registry
    model.run("node.add", other);
    model.run("edge.add", {
        source: "a",
        target: "b",
        type: "dependency",
        data: { weight: 1 },
    });
    model.run("edge.add", { source: "a", target: "b", type: "smoothstep" });
    model.run("edge.add", { source: "a", target: "b", type: "simplebezier" });
    model.run("edge.add", {
        source: "a",
        target: "b",
        type: "smoothstep",
        animated: true,
        pathOptions: { stepPosition: 0.25, borderRadius: 8 },
    });
    model.run("edge.set-flags", { edgeId: "e", animated: false });
    model.run("edge.add", {
        source: "a",
        target: "b",
        // @ts-expect-error a path option the built-in paths do not read
        pathOptions: { wobble: 1 },
    });
    // @ts-expect-error: a dependency's weight is a number
    model.run("edge.add", {
        source: "a",
        target: "b",
        type: "dependency",
        data: { weight: "1" },
    });
    model.run("node.set-data", { nodeId: "a", data: { done: true } });
    const node = model.get("node-by", { id: "a" });
    if (node?.type === "task") {
        const title: string = node.data.title;
        use(title);
    }
    // the neighbours are the registry's nodes
    for (const incomer of model.get("incomers-by", { nodeId: "a" })) {
        if (incomer.type === "task") use(incomer.data.title);
    }
    use(model.get("outgoers-by", { nodeId: "a" }).length);
    // @ts-expect-error the neighbours of a node, by its id
    model.get("outgoers-by", { id: "a" });
    // a node's data narrows by its type; its connections name their ends
    for (const entry of model.get("nodes-data-by", { nodeIds: ["a"] })) {
        if (entry.type === "task") use(entry.data.title);
    }
    for (const connection of model.get("node-connections-by", {
        nodeId: "a",
        handleType: "target",
    })) {
        const ends: [string, string | undefined] = [
            connection.edgeId,
            connection.targetHandle,
        ];
        use(ends);
    }
    // @ts-expect-error a handle type is source or target
    model.get("node-connections-by", { nodeId: "a", handleType: "in" });
}

export function results(model: FlowModel): void {
    const moved = model.run("node.move", {
        nodeId: "a",
        position: { x: 1, y: 2 },
    });
    if (moved.ok) {
        const x: number = moved.value.position.x;
        use(x);
    } else {
        const code: string = moved.error.code;
        use(code);
    }
    const removed = model.check("node.remove", { nodeId: "a" });
    if (removed.ok) {
        const ids: string[] = removed.value.removedEdgeIds;
        use(ids);
    }
    // @ts-expect-error: a position is { x, y }
    model.run("node.move", { nodeId: "a", position: { x: 1 } });
    // @ts-expect-error: unknown command
    model.run("node.fly", {});
    // @ts-expect-error: the id field is nodeId
    model.run("node.remove", { id: "a" });
    model.run(
        "node.move",
        { nodeId: "a", position: { x: 1, y: 2 } },
        { transient: true },
    );
}

export function features(): void {
    const bare = createFlowModel(json);
    // @ts-expect-error: the selection feature is not installed
    bare.run("selection.set", { nodeIds: ["a"] });
    // @ts-expect-error: the subflows feature is not installed
    bare.run("node.set-parent", { nodeId: "a", parentId: null });
    // @ts-expect-error: the selection feature's key
    bare.get("selected-nodes");
    // @ts-expect-error: the selection feature's question
    bare.is("node-selected", { nodeId: "a" });
    // @ts-expect-error: the subflows feature's key
    bare.get("node-parent-by", { nodeId: "a" });

    const installed = [
        selection(),
        subflows(),
        connection(),
        reconnection(),
    ] as const;
    const model = createFlowModel<Types, typeof installed>(json, {
        features: installed,
    });
    model.run("selection.set", { nodeIds: ["a"], mode: "toggle" });
    model.run("selection.clear");
    model.run("selection.remove");
    model.run("node.set-parent", {
        nodeId: "a",
        parentId: "group",
        extent: "parent",
    });
    model.run("edge.reconnect", { edgeId: "e", source: "a", target: "b" });
    const selected = model.get("selected-nodes");
    const parent = model.get("node-parent-by", { nodeId: "a" });
    use([selected, parent, model.is("edge-selected", { edgeId: "e" })]);
    // @ts-expect-error: a mode is replace, add or toggle
    model.run("selection.set", { mode: "remove" });

    // inferred from the options too
    const inferred = createFlowModel(json, { features: [selection()] });
    inferred.run("selection.clear");
    // @ts-expect-error: only selection is installed
    inferred.run("node.set-parent", { nodeId: "a", parentId: null });

    // a model with features is a model (of any features), and so is a bare one
    const any: FlowModel<Types> = model;
    const anyBare: FlowModel<Types> = bare;
    any.run("selection.clear");
    use(anyBare);
}

export function middleware(model: FlowModel<Types, readonly []>): void {
    model.use((ctx, next) => {
        if (ctx.command === "edge.add") {
            const source: string = ctx.payload.source;
            if (source === ctx.payload.target) return veto("no loops");
        } else if (ctx.command === "node.move") {
            // @ts-expect-error: a move has no edgeId
            ctx.payload.edgeId;
            // @ts-expect-error: not installed: not a command the context can be
            if (ctx.command === "selection.set") use(ctx);
        }
        return next();
    });
    model.subscribe((event) => {
        const transient: boolean = event.transient;
        use([transient, event.after.nodes]);
    });
    // @ts-expect-error: node-by takes an id
    model.get("node-by", { nodeId: "a" });
    // @ts-expect-error: node-by needs its payload
    model.get("node-by");
    // @ts-expect-error: an unknown key
    model.get("node-width");
    const json2 = model.get("flow-json");
    const version: 1 = json2.version;
    const id: string = json2.nodes[0]?.id ?? "";
    use([version, id, model.is("node-draggable", { nodeId: "a" })]);
}
