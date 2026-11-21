import { describe, expect, it } from "vitest";
import { IdSource } from "../../src/document/create-id";

describe("IdSource", () => {
    it("counts per kind, skipping ids in use", () => {
        const ids = new IdSource();
        const used = new Set(["node-1"]);
        expect(ids.next("node", (id) => used.has(id))).toBe("node-2");
        expect(ids.next("edge", () => false)).toBe("edge-1");
        expect(ids.next("node", () => false)).toBe("node-3");
    });

    it("asks a custom generator first, and falls back when it keeps giving used or empty ids", () => {
        let n = 0;
        const ids = new IdSource((kind) => `${kind}:${++n}`);
        expect(ids.next("node", () => false)).toBe("node:1");
        expect(new IdSource(() => "").next("edge", () => false)).toBe("edge-1");
        expect(new IdSource(() => "x").next("node", (id) => id === "x")).toBe(
            "node-1",
        );
    });

    it("clones its counters for a dry run", () => {
        const ids = new IdSource();
        ids.next("node", () => false);
        const copy = ids.dryClone();
        expect(copy.next("node", () => false)).toBe("node-2");
        expect(ids.next("node", () => false)).toBe("node-2");
    });
});
