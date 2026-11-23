// @vitest-environment jsdom
// The engine on large flows (Issue #59), not part of `pnpm test`: `pnpm --filter @fragiola/flow
// bench` (vitest.bench.config.ts) prints the median time of each step, per size. A grid of nodes (declared sizes and handles, as the `stress-test` example's) joined into
// a tree, culled (`onlyRenderVisible`) in an 800 × 600 root; a viewport step (`pan-by`) and a drag
// step (a transient `node.move`), each followed by what an adapter reads for a frame: the visible
// nodes with their boxes and z-indexes, the drawn edges with their paths, the render layers. With
// the cached geometry both steps cost about the same at 1 000, 10 000 and 20 000 nodes: the work
// follows what is in view and what moved, not the flow's size; what grows with it in a drag step
// is the model's command (its copy-on-write node list, D3), shown apart.
import { expect, it } from "vitest";
import type { FlowJson } from "../../src/document/types";
import { createFlowEngine } from "../../src/engine/create-flow-engine";
import { createFlowModel } from "../../src/model/create-flow-model";

const HANDLES = [
    { id: "left", type: "target", position: "left", x: 0, y: 20 },
    { id: "right", type: "source", position: "right", x: 120, y: 20 },
] as const;

/** `count` nodes on a grid (200 × 100 cells), each joined to its left or upper neighbour. */
function grid(count: number): FlowJson {
    const columns = Math.ceil(Math.sqrt(count / 2));
    const nodes: FlowJson["nodes"] = [];
    const edges: FlowJson["edges"] = [];
    for (let i = 0; i < count; i++) {
        nodes.push({
            id: `n${i}`,
            type: "cell",
            position: {
                x: (i % columns) * 200,
                y: Math.floor(i / columns) * 100,
            },
            width: 120,
            height: 40,
            handles: [...HANDLES],
            data: {},
        } as FlowJson["nodes"][number]);
        if (i > 0) {
            const from = i % columns === 0 ? i - columns : i - 1;
            edges.push({
                id: `e${i}`,
                source: `n${from}`,
                target: `n${i}`,
                sourceHandle: "right",
                targetHandle: "left",
            });
        }
    }
    return { version: 1, nodes, edges };
}

function setup(count: number) {
    const model = createFlowModel(grid(count));
    const engine = createFlowEngine(model, { onlyRenderVisible: true });
    const root = document.createElement("div");
    root.getBoundingClientRect = () =>
        ({
            left: 0,
            top: 0,
            width: 800,
            height: 600,
            right: 800,
            bottom: 600,
            x: 0,
            y: 0,
            toJSON: () => ({}),
        }) as DOMRect;
    document.body.append(root);
    engine.adapter.attachRoot(root);
    /** What an adapter reads for a frame. */
    const frame = () => {
        let sink = 0;
        for (const node of engine.get("visible-nodes")) {
            sink += engine.get("node-rect-by", { nodeId: node.id })?.x ?? 0;
            sink += engine.get("node-z-index-by", { nodeId: node.id });
        }
        for (const edge of engine.get("drawn-edges")) {
            sink +=
                engine.get("edge-path-by", { edgeId: edge.id })?.path.length ??
                0;
        }
        sink += engine.get("render-layers").length;
        return sink;
    };
    frame();
    let step = 0;
    return {
        pan: () => {
            step += 1;
            engine.run("pan-by", { x: step % 2 === 0 ? 7 : -7, y: 3 });
            return frame();
        },
        /** the drag step's command alone: the model's copy of the node list (D3) */
        move: () => {
            step += 1;
            return model.run(
                "node.move",
                { nodeId: "n1", position: { x: 200 + (step % 40), y: 10 } },
                { transient: true },
            );
        },
        drag: () => {
            step += 1;
            model.run(
                "node.move",
                { nodeId: "n1", position: { x: 200 + (step % 40), y: 10 } },
                { transient: true },
            );
            return frame();
        },
    };
}

/** The median time of `run`, in milliseconds, over `times` runs after a warm-up. */
function median(run: () => unknown, times = 300): number {
    for (let i = 0; i < 30; i++) run();
    const samples: number[] = [];
    for (let i = 0; i < times; i++) {
        const start = performance.now();
        run();
        samples.push(performance.now() - start);
    }
    samples.sort((a, b) => a - b);
    return samples[Math.floor(samples.length / 2)] ?? 0;
}

it("prints a viewport step's and a drag step's time at 1 000, 10 000 and 20 000 nodes", () => {
    const rows: string[] = [
        "| nodes | viewport step (ms) | drag step (ms) | of which the model's node.move (ms) |",
        "| --- | --- | --- | --- |",
    ];
    for (const count of [1_000, 10_000, 20_000]) {
        const flow = setup(count);
        const pan = median(flow.pan);
        const drag = median(flow.drag);
        const move = median(flow.move);
        rows.push(
            `| ${count.toLocaleString("en-US")} | ${pan.toFixed(3)} | ${drag.toFixed(3)} | ${move.toFixed(3)} |`,
        );
        expect(pan).toBeGreaterThan(0);
    }
    console.log(rows.join("\n"));
});
