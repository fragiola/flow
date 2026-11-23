// The root's box hold (Epic #61, #60 in Vue): while the nodes layer patches, the root's box is
// read once, so its new nodes' reads of the view do not each lay the page out.
import { describe, expect, it, vi } from "vitest";
import { holdRootBox } from "../src/utils/root-box";

describe("the root's box hold", () => {
    it("reads the box once until the microtasks run, then every time; released, the element's own", async () => {
        const element = document.createElement("div");
        const read = vi
            .spyOn(Element.prototype, "getBoundingClientRect")
            .mockImplementation(() => new DOMRect(0, 0, 800, 600));
        const box = holdRootBox(element);
        element.getBoundingClientRect();
        element.getBoundingClientRect();
        expect(read).toHaveBeenCalledTimes(2);
        box.hold();
        const first = element.getBoundingClientRect();
        expect(element.getBoundingClientRect()).toBe(first);
        expect(read).toHaveBeenCalledTimes(3);
        await Promise.resolve();
        element.getBoundingClientRect();
        expect(read).toHaveBeenCalledTimes(4);
        box.release();
        expect(Object.hasOwn(element, "getBoundingClientRect")).toBe(false);
        read.mockRestore();
    });
});
