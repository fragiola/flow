import { describe, expect, it } from "vitest";
import {
    edgeIdFor,
    joined,
    reconnectionPlan,
} from "../src/examples/delete-middle-node/reconnect";

// The delete-middle-node example's planning: which edges join a deleted node's incomers to its
// outgoers, skipping duplicates and self loops, and their ids.

const link = (source: string, target: string, id = `${source}-${target}`) => ({
    id,
    source,
    target,
});

const pairs = (edges: readonly { source: string; target: string }[]) =>
    edges.map((edge) => `${edge.source}>${edge.target}`);

describe("reconnectionPlan", () => {
    it("joins the two ends of a chain around its middle", () => {
        const plan = reconnectionPlan([link("a", "b"), link("b", "c")], ["b"]);
        expect(plan).toEqual([{ id: "a-c", source: "a", target: "c" }]);
    });

    it("joins every incomer to every outgoer", () => {
        const plan = reconnectionPlan(
            [link("a", "m"), link("b", "m"), link("m", "x"), link("m", "y")],
            ["m"],
        );
        expect(pairs(plan)).toEqual(["a>x", "a>y", "b>x", "b>y"]);
    });

    it("skips a pair joined already, in that direction", () => {
        const plan = reconnectionPlan(
            [link("a", "m"), link("m", "x"), link("a", "x")],
            ["m"],
        );
        expect(plan).toEqual([]);
        // the other direction is no duplicate
        const reverse = reconnectionPlan(
            [link("a", "m"), link("m", "x"), link("x", "a")],
            ["m"],
        );
        expect(pairs(reverse)).toEqual(["a>x"]);
    });

    it("never plans a self loop", () => {
        const plan = reconnectionPlan([link("a", "m"), link("m", "a")], ["m"]);
        expect(plan).toEqual([]);
    });

    it("ignores the deleted node's own self loop", () => {
        const plan = reconnectionPlan(
            [link("m", "m"), link("a", "m"), link("m", "b")],
            ["m"],
        );
        expect(pairs(plan)).toEqual(["a>b"]);
    });

    it("plans nothing for a node without incomers or outgoers", () => {
        expect(reconnectionPlan([link("m", "x")], ["m"])).toEqual([]);
        expect(reconnectionPlan([link("a", "m")], ["m"])).toEqual([]);
        expect(reconnectionPlan([link("a", "b")], ["m"])).toEqual([]);
    });

    it("joins across several deleted nodes, keeping none that touches them", () => {
        const plan = reconnectionPlan(
            [link("a", "b"), link("b", "c"), link("c", "d")],
            ["b", "c"],
        );
        expect(plan).toEqual([{ id: "a-d", source: "a", target: "d" }]);
    });

    it("counts a deleted node once", () => {
        const plan = reconnectionPlan(
            [link("a", "m"), link("m", "b")],
            ["m", "m"],
        );
        expect(pairs(plan)).toEqual(["a>b"]);
    });

    it("leaves out the edges deleted with the nodes", () => {
        const plan = reconnectionPlan(
            [link("a", "m"), link("b", "m"), link("m", "x")],
            ["m"],
            { removedEdgeIds: ["a-m"] },
        );
        expect(pairs(plan)).toEqual(["b>x"]);
    });

    it("keeps the handles the old edges used at the far ends", () => {
        const plan = reconnectionPlan(
            [
                { ...link("a", "m"), sourceHandle: "out", targetHandle: "in" },
                { ...link("m", "b"), sourceHandle: "out", targetHandle: "top" },
            ],
            ["m"],
        );
        expect(plan).toEqual([
            {
                id: "a-b",
                source: "a",
                target: "b",
                sourceHandle: "out",
                targetHandle: "top",
            },
        ]);
    });

    it("picks a free id", () => {
        const plan = reconnectionPlan(
            [link("a", "m"), link("m", "b"), link("x", "y", "a-b")],
            ["m"],
            { isTaken: (id) => id === "a-b-2" },
        );
        expect(plan.map((edge) => edge.id)).toEqual(["a-b-3"]);
    });
});

describe("joined", () => {
    it("says whether an edge runs from source to target", () => {
        expect(joined([link("a", "b")], "a", "b")).toBe(true);
        expect(joined([link("a", "b")], "b", "a")).toBe(false);
    });
});

describe("edgeIdFor", () => {
    it("is source-target, numbered when taken", () => {
        expect(edgeIdFor("a", "b", () => false)).toBe("a-b");
        const taken = new Set(["a-b", "a-b-2"]);
        expect(edgeIdFor("a", "b", (id) => taken.has(id))).toBe("a-b-3");
    });
});
