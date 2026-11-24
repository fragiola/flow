// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
    createSimulation,
    type ForceNode,
    type ForceNodeInput,
    isPinned,
    movesOf,
    pinAt,
    radiusOf,
    tenth,
    toForceLinks,
    toForceNodes,
    topLeftOf,
    unpin,
} from "../src/examples/force-layout/forces";

// The force-layout example's adapter: the document's top-left corners to bodies by their centre
// (with the radius of their box) and back to `node.move` payloads to a tenth; a stopped simulation
// run tick by tick pulls linked nodes nearer than unlinked ones, keeps the boxes apart, and leaves
// a pinned body where it was put.

const box = (
    id: string,
    x: number,
    y: number,
    width = 120,
    height = 40,
): ForceNodeInput => ({ id, position: { x, y }, width, height });

// two clusters of four, joined by one link, all started close together
const inputs: ForceNodeInput[] = [
    box("a1", 0, 0),
    box("a2", 10, 5),
    box("a3", 20, -5, 140, 48),
    box("a4", -10, 10),
    box("b1", 30, 0),
    box("b2", 40, 10),
    box("b3", 50, -10),
    box("b4", 35, 20, 100, 36),
];

const LINKS = [
    ["a1", "a2"],
    ["a1", "a3"],
    ["a2", "a3"],
    ["a3", "a4"],
    ["b1", "b2"],
    ["b1", "b3"],
    ["b2", "b4"],
    ["b3", "b4"],
    ["a4", "b1"],
] as const;

const edges = LINKS.map(([source, target]) => ({ source, target }));

const centre = (node: ForceNode) => ({ x: node.x ?? 0, y: node.y ?? 0 });

const distance = (a: ForceNode, b: ForceNode) =>
    Math.hypot((a.x ?? 0) - (b.x ?? 0), (a.y ?? 0) - (b.y ?? 0));

/** The settled bodies after `ticks` ticks of a stopped simulation. */
function settled(ticks = 300) {
    const bodies = toForceNodes(inputs);
    createSimulation(bodies, toForceLinks(edges)).tick(ticks);
    return bodies;
}

describe("toForceNodes", () => {
    it("places each body at its box's centre, with the radius of its box", () => {
        const [body] = toForceNodes([box("n", 10, 20, 100, 40)]);
        expect(body).toMatchObject({
            id: "n",
            x: 60,
            y: 40,
            width: 100,
            height: 40,
            radius: radiusOf(100, 40),
        });
        expect(radiusOf(30, 40)).toBe(25);
    });
});

describe("toForceLinks", () => {
    it("makes one link per edge, by the ids of its ends", () => {
        expect(toForceLinks(edges.slice(0, 2))).toEqual([
            { source: "a1", target: "a2" },
            { source: "a1", target: "a3" },
        ]);
    });
});

describe("topLeftOf and movesOf", () => {
    it("give back the top-left corner, to a tenth", () => {
        const [body] = toForceNodes([box("n", 10, 20, 100, 40)]);
        if (!body) throw new Error("no body");
        expect(topLeftOf(body)).toEqual({ x: 10, y: 20 });
        body.x = 60.123;
        body.y = 39.96;
        expect(topLeftOf(body)).toEqual({ x: 10.1, y: 20 });
        expect(tenth(1.25)).toBe(1.3);
        expect(tenth(-0.04)).toBe(-0);
    });

    it("round-trip the document's corners", () => {
        const moves = movesOf(toForceNodes(inputs));
        expect(moves).toEqual(
            inputs.map((input) => ({
                nodeId: input.id,
                position: input.position,
            })),
        );
    });

    it("leave out the bodies `skip` says", () => {
        const moves = movesOf(toForceNodes(inputs), (body) =>
            body.id.startsWith("a"),
        );
        expect(moves.map((move) => move.nodeId)).toEqual([
            "b1",
            "b2",
            "b3",
            "b4",
        ]);
    });
});

describe("createSimulation", () => {
    it("is created stopped: nothing moves until it ticks", () => {
        const bodies = toForceNodes(inputs);
        const before = bodies.map(centre);
        const simulation = createSimulation(bodies, toForceLinks(edges));
        expect(bodies.map(centre)).toEqual(before);
        simulation.tick(1);
        expect(bodies.map(centre)).not.toEqual(before);
    });

    it("pulls linked nodes nearer than unlinked ones", () => {
        const bodies = settled();
        const byId = new Map(bodies.map((body) => [body.id, body]));
        const linked = new Set(LINKS.map(([a, b]) => `${a}|${b}`));
        const near: number[] = [];
        const far: number[] = [];
        for (const [index, a] of bodies.entries()) {
            for (const b of bodies.slice(index + 1)) {
                const joined =
                    linked.has(`${a.id}|${b.id}`) ||
                    linked.has(`${b.id}|${a.id}`);
                (joined ? near : far).push(distance(a, b));
            }
        }
        const mean = (values: number[]) =>
            values.reduce((sum, value) => sum + value, 0) / values.length;
        expect(mean(near)).toBeLessThan(mean(far));
        // the two clusters end apart: each one's nodes nearer each other than the other's
        const a1 = byId.get("a1") as ForceNode;
        const a2 = byId.get("a2") as ForceNode;
        const b3 = byId.get("b3") as ForceNode;
        expect(distance(a1, a2)).toBeLessThan(distance(a1, b3));
    });

    it("keeps the boxes apart (the collision of their circles)", () => {
        const bodies = settled();
        for (const [index, a] of bodies.entries()) {
            for (const b of bodies.slice(index + 1)) {
                const at = topLeftOf(a);
                const bt = topLeftOf(b);
                // overlap of the two boxes on each axis (negative: apart)
                const overlapX =
                    Math.min(at.x + a.width, bt.x + b.width) -
                    Math.max(at.x, bt.x);
                const overlapY =
                    Math.min(at.y + a.height, bt.y + b.height) -
                    Math.max(at.y, bt.y);
                const overlap = Math.min(overlapX, overlapY);
                expect(overlap, `${a.id} and ${b.id}`).toBeLessThanOrEqual(1);
            }
        }
    });

    it("leaves a pinned body where it was put", () => {
        const bodies = toForceNodes(inputs);
        const simulation = createSimulation(bodies, toForceLinks(edges));
        const a3 = bodies.find((body) => body.id === "a3") as ForceNode;
        pinAt(a3, { x: 500, y: -300 });
        expect(isPinned(a3)).toBe(true);
        simulation.tick(200);
        expect(topLeftOf(a3)).toEqual({ x: 500, y: -300 });
        // its neighbours were drawn towards it
        const a1 = bodies.find((body) => body.id === "a1") as ForceNode;
        expect(a1.x ?? 0).toBeGreaterThan(60);
        // released, the forces move it again
        unpin(a3);
        expect(isPinned(a3)).toBe(false);
        simulation.tick(50);
        expect(topLeftOf(a3)).not.toEqual({ x: 500, y: -300 });
    });

    it("cools down: alpha falls below its minimum in under 200 ticks", () => {
        const simulation = createSimulation(
            toForceNodes(inputs),
            toForceLinks(edges),
        );
        simulation.tick(200);
        expect(simulation.alpha()).toBeLessThan(simulation.alphaMin());
    });
});
