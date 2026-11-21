import { describe, expect, it } from "vitest";
import { straightPath } from "../../src/geometry/straight-path";

describe("straightPath", () => {
    it("draws one line, its label halfway", () => {
        expect(
            straightPath({ source: { x: 0, y: 0 }, target: { x: 10, y: 20 } }),
        ).toEqual({ path: "M0,0 L10,20", label: { x: 5, y: 10 } });
    });
});
