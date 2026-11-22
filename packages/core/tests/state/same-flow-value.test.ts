// `sameFlowValue`: how every adapter's hooks tell a changed read from an equal one.
import { describe, expect, it } from "vitest";
import { sameFlowValue } from "../../src/state/same-flow-value";

describe("sameFlowValue", () => {
    it("compares arrays and plain records all the way down", () => {
        expect(sameFlowValue(3, 3)).toBe(true);
        expect(sameFlowValue(Number.NaN, Number.NaN)).toBe(true);
        expect(sameFlowValue([1, { a: [2, "x"] }], [1, { a: [2, "x"] }])).toBe(
            true,
        );
        expect(sameFlowValue([1, { a: [2, "x"] }], [1, { a: [2, "y"] }])).toBe(
            false,
        );
        expect(sameFlowValue({ a: 1 }, { a: 1, b: undefined })).toBe(false);
        expect(sameFlowValue({ a: undefined }, { b: undefined })).toBe(false);
        expect(sameFlowValue([1, 2], [1, 2, 3])).toBe(false);
        expect(sameFlowValue(null, {})).toBe(false);
        expect(sameFlowValue([], {})).toBe(false);
    });

    it("takes anything else only when it is the very same", () => {
        class Box {
            constructor(readonly value: number) {}
        }
        const box = new Box(1);
        expect(sameFlowValue(box, box)).toBe(true);
        expect(sameFlowValue(new Box(1), new Box(1))).toBe(false);
        const f = () => 0;
        expect(sameFlowValue({ f }, { f })).toBe(true);
        expect(sameFlowValue({ f }, { f: () => 0 })).toBe(false);
    });
});
