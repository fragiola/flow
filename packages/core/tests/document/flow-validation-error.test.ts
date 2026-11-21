import { describe, expect, it } from "vitest";
import { FlowValidationError } from "../../src/document/flow-validation-error";

describe("FlowValidationError", () => {
    it("carries every issue and names the first one", () => {
        const error = new FlowValidationError([
            { path: "/nodes/0/type", message: "is required" },
            { path: "", message: "must be an object" },
        ]);
        expect(error).toBeInstanceOf(Error);
        expect(error.name).toBe("FlowValidationError");
        expect(error.issues).toHaveLength(2);
        expect(error.message).toBe(
            "invalid flow document: /nodes/0/type is required (and 1 more)",
        );
        expect(
            new FlowValidationError([{ path: "", message: "x" }]).message,
        ).toBe("invalid flow document: / x");
    });
});
