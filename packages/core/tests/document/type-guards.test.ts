import { describe, expect, it } from "vitest";
import { isEdge, isNode } from "../../src/document/type-guards";

describe("isNode and isEdge", () => {
    const node = {
        id: "n",
        type: "default",
        position: { x: 0, y: 0 },
        data: {},
    };
    const edge = { id: "e", source: "a", target: "b" };

    it("tell a node from an edge by their shape", () => {
        expect(isNode(node)).toBe(true);
        expect(isEdge(node)).toBe(false);
        expect(isEdge(edge)).toBe(true);
        expect(isNode(edge)).toBe(false);
        const mixed: unknown[] = [node, edge];
        expect(mixed.filter(isNode).map((item) => item.id)).toEqual(["n"]);
        expect(mixed.filter(isEdge).map((item) => item.source)).toEqual(["a"]);
    });

    it("are false for anything else", () => {
        for (const value of [
            null,
            undefined,
            "n",
            [],
            { id: "n" },
            { id: 1, position: { x: 0, y: 0 } },
            { id: "n", position: { x: "0", y: 0 } },
            { id: "e", source: "a" },
            { id: "n", position: { x: 0, y: 0 }, source: "a" },
        ]) {
            expect(isNode(value)).toBe(false);
            expect(isEdge(value)).toBe(false);
        }
    });
});
