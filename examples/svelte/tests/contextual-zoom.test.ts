import { describe, expect, it } from "vitest";
import {
    atLeast,
    DETAIL_ZOOM,
    DETAILS,
    detailOf,
    LABEL_ZOOM,
    showsLabels,
} from "../src/examples/contextual-zoom/detail";

// The contextual-zoom example's thresholds: the detail level a zoom gives, and the zoom from which
// the edges' labels show.

describe("detailOf", () => {
    it("is low below the medium threshold", () => {
        expect(detailOf(0.1)).toBe("low");
        expect(detailOf(0.5)).toBe("low");
        expect(detailOf(DETAIL_ZOOM.medium - 0.001)).toBe("low");
    });

    it("is medium from its threshold to the high one", () => {
        expect(detailOf(DETAIL_ZOOM.medium)).toBe("medium");
        expect(detailOf(1)).toBe("medium");
        expect(detailOf(DETAIL_ZOOM.high - 0.001)).toBe("medium");
    });

    it("is high from its threshold up", () => {
        expect(detailOf(DETAIL_ZOOM.high)).toBe("high");
        expect(detailOf(2)).toBe("high");
        expect(detailOf(10)).toBe("high");
    });

    it("never goes down as the zoom goes up", () => {
        let last = -1;
        for (let zoom = 0.1; zoom <= 3; zoom += 0.05) {
            const index = DETAILS.indexOf(detailOf(zoom));
            expect(index).toBeGreaterThanOrEqual(last);
            last = index;
        }
        expect(last).toBe(DETAILS.length - 1);
    });

    it("spans more than one zoom button press per level (a press multiplies by 1.2)", () => {
        expect(DETAIL_ZOOM.high / DETAIL_ZOOM.medium).toBeGreaterThan(1.2);
    });
});

describe("showsLabels", () => {
    it("hides the labels below their zoom and shows them from it", () => {
        expect(showsLabels(LABEL_ZOOM - 0.001)).toBe(false);
        expect(showsLabels(0.5)).toBe(false);
        expect(showsLabels(LABEL_ZOOM)).toBe(true);
        expect(showsLabels(2)).toBe(true);
    });

    it("never at low detail, always at high", () => {
        expect(LABEL_ZOOM).toBeGreaterThan(DETAIL_ZOOM.medium);
        expect(LABEL_ZOOM).toBeLessThan(DETAIL_ZOOM.high);
    });
});

describe("atLeast", () => {
    it("orders the levels low, medium, high", () => {
        expect(atLeast("low", "low")).toBe(true);
        expect(atLeast("low", "medium")).toBe(false);
        expect(atLeast("medium", "medium")).toBe(true);
        expect(atLeast("medium", "high")).toBe(false);
        expect(atLeast("high", "low")).toBe(true);
        expect(atLeast("high", "high")).toBe(true);
    });
});
