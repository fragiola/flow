// @vitest-environment node
import { createFlowModel, validateFlow } from "@fragiola/flow-react";
import { describe, expect, it } from "vitest";
import {
    formatMs,
    frameMeter,
    medianOf,
} from "../src/examples/stress-test/frames";
import {
    CELL_X,
    CELL_Y,
    columnsOf,
    generateFlow,
    JITTER_X,
    JITTER_Y,
    labelOf,
    random,
    SIZES,
    shuffle,
} from "../src/examples/stress-test/generate";

// The stress-test example: the seeded generator (the same flow for the same size and seed, a grid
// joined into one tree), the shuffle (every node moves, near its cell) and the frame meter (the
// median of the recent intervals).

describe("random", () => {
    it("gives the same sequence for the same seed, in [0, 1)", () => {
        const a = random(7);
        const b = random(7);
        const values = Array.from({ length: 200 }, () => a());
        expect(Array.from({ length: 200 }, () => b())).toEqual(values);
        for (const value of values) {
            expect(value).toBeGreaterThanOrEqual(0);
            expect(value).toBeLessThan(1);
        }
    });

    it("gives another sequence for another seed", () => {
        const a = random(1);
        const b = random(2);
        expect([a(), a(), a()]).not.toEqual([b(), b(), b()]);
    });
});

describe("generateFlow", () => {
    it("offers 1,000 nodes first, then 5,000, 10,000 and 20,000", () => {
        expect(SIZES).toEqual([1_000, 5_000, 10_000, 20_000]);
    });

    it("makes `count` nodes and `count - 1` edges with unique ids", () => {
        const { nodes, edges } = generateFlow(1_000);
        expect(nodes).toHaveLength(1_000);
        expect(edges).toHaveLength(999);
        expect(new Set(nodes.map((node) => node.id)).size).toBe(1_000);
        expect(new Set(edges.map((edge) => edge.id)).size).toBe(999);
        expect(nodes[0]?.id).toBe("n1");
        expect(nodes[0]?.data.label).toBe("Node 1");
        expect(labelOf("n42")).toBe("Node 42");
    });

    it("is the same flow for the same size and seed, another for another seed", () => {
        expect(generateFlow(500)).toEqual(generateFlow(500));
        expect(generateFlow(500, 2)).not.toEqual(generateFlow(500));
    });

    it("places each node near its cell of an about square grid", () => {
        const count = 1_000;
        const columns = columnsOf(count);
        expect(columns * CELL_X).toBeGreaterThan(
            Math.ceil(count / columns) * CELL_Y * 0.8,
        );
        generateFlow(count).nodes.forEach((node, index) => {
            const x = (index % columns) * CELL_X;
            const y = Math.floor(index / columns) * CELL_Y;
            expect(Math.abs(node.position.x - x)).toBeLessThanOrEqual(JITTER_X);
            expect(Math.abs(node.position.y - y)).toBeLessThanOrEqual(JITTER_Y);
            expect(Number.isInteger(node.position.x)).toBe(true);
        });
    });

    it("joins every node into one tree, each edge from a left or upper neighbour", () => {
        const count = 2_000;
        const columns = columnsOf(count);
        const { nodes, edges } = generateFlow(count);
        const index = new Map(nodes.map((node, at) => [node.id, at]));
        const incoming = new Map<string, number>();
        for (const edge of edges) {
            const from = index.get(edge.source) as number;
            const to = index.get(edge.target) as number;
            incoming.set(edge.target, (incoming.get(edge.target) ?? 0) + 1);
            if (edge.sourceHandle === "right") {
                expect(to - from).toBe(1);
                expect(edge.targetHandle).toBe("left");
                expect(to % columns).not.toBe(0);
            } else {
                expect(to - from).toBe(columns);
                expect(edge.targetHandle).toBe("top");
            }
        }
        // one edge in for every node but the first: a tree
        expect(incoming.has("n1")).toBe(false);
        for (const node of nodes.slice(1))
            expect(incoming.get(node.id)).toBe(1);
        // both kinds are drawn
        expect(edges.some((edge) => edge.sourceHandle === "right")).toBe(true);
        expect(edges.some((edge) => edge.sourceHandle === "bottom")).toBe(true);
    });

    it("is a valid flow whose nodes declare their size and handles", () => {
        const { nodes, edges } = generateFlow(300);
        expect(() => validateFlow({ version: 1, nodes, edges })).not.toThrow();
        const model = createFlowModel({ version: 1, nodes, edges });
        expect(model.get("all-nodes")).toHaveLength(300);
        expect(model.get("all-edges")).toHaveLength(299);
        for (const node of nodes) {
            expect(node.width).toBeGreaterThan(0);
            expect(node.height).toBeGreaterThan(0);
            expect(node.handles.map((handle) => handle.id)).toEqual([
                "left",
                "top",
                "right",
                "bottom",
            ]);
        }
    });

    it("makes 20,000 nodes quickly", () => {
        const started = performance.now();
        const { nodes, edges } = generateFlow(20_000);
        expect(nodes).toHaveLength(20_000);
        expect(edges).toHaveLength(19_999);
        expect(performance.now() - started).toBeLessThan(1_000);
    });
});

describe("shuffle", () => {
    it("moves every node, near its own cell, the same way for the same seed", () => {
        const { nodes } = generateFlow(1_000);
        const columns = columnsOf(1_000);
        const moves = shuffle(nodes, 5);
        expect(moves).toHaveLength(1_000);
        expect(shuffle(nodes, 5)).toEqual(moves);
        expect(shuffle(nodes, 6)).not.toEqual(moves);
        moves.forEach((move, index) => {
            const node = nodes[index];
            expect(move.nodeId).toBe(node?.id);
            expect(move.position).not.toEqual(node?.position);
            const x = (index % columns) * CELL_X;
            const y = Math.floor(index / columns) * CELL_Y;
            expect(Math.abs(move.position.x - x)).toBeLessThanOrEqual(
                JITTER_X + 1,
            );
            expect(Math.abs(move.position.y - y)).toBeLessThanOrEqual(JITTER_Y);
        });
    });

    it("moves a node that its new offset would leave in place", () => {
        const { nodes } = generateFlow(50);
        // nodes already where the seed 9 would put them
        const placed = shuffle(nodes, 9).map(({ nodeId, position }) => ({
            id: nodeId,
            position,
        }));
        shuffle(placed, 9).forEach((move, index) => {
            const was = placed[index]?.position;
            expect(move.position).toEqual({ x: (was?.x ?? 0) + 1, y: was?.y });
        });
    });

    it("applies as one batch of node.move", () => {
        const { nodes, edges } = generateFlow(200);
        const model = createFlowModel({ version: 1, nodes, edges });
        const moves = shuffle(model.get("all-nodes"), 3);
        model.run("batch", {
            commands: moves.map((payload) => ({
                command: "node.move" as const,
                payload,
            })),
        });
        model.get("all-nodes").forEach((node, index) => {
            expect(node.position).toEqual(moves[index]?.position);
        });
    });
});

describe("frameMeter", () => {
    it("has no median before two frames", () => {
        const meter = frameMeter();
        expect(meter.median()).toBeUndefined();
        meter.tick(100);
        expect(meter.median()).toBeUndefined();
        expect(meter.max()).toBeUndefined();
    });

    it("is the median of the intervals, one slow frame aside", () => {
        const meter = frameMeter();
        for (const time of [0, 16, 32, 48, 148, 164]) meter.tick(time);
        // 16, 16, 16, 100, 16
        expect(meter.median()).toBe(16);
        expect(meter.max()).toBe(100);
    });

    it("keeps only the last `size` intervals", () => {
        const meter = frameMeter(3);
        for (const time of [0, 50, 100, 150, 160, 170, 180]) meter.tick(time);
        // 50, 50, 50, 10, 10, 10: the last three
        expect(meter.median()).toBe(10);
        expect(meter.max()).toBe(10);
    });

    it("forgets every frame on reset, so a pause is no frame", () => {
        const meter = frameMeter();
        meter.tick(0);
        meter.tick(16);
        meter.reset();
        meter.tick(5_000);
        expect(meter.median()).toBeUndefined();
        meter.tick(5_020);
        expect(meter.median()).toBe(20);
    });
});

describe("medianOf and formatMs", () => {
    it("is the middle value, or the mean of the middle two", () => {
        expect(medianOf([])).toBeUndefined();
        expect(medianOf([3, 1, 2])).toBe(2);
        expect(medianOf([4, 1, 3, 2])).toBe(2.5);
    });

    it("shows one decimal, or a dash for none", () => {
        expect(formatMs(16.6666)).toBe("16.7");
        expect(formatMs(undefined)).toBe("–");
    });
});
