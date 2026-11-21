import type { ValidationIssue } from "../schema/types";

/** A flow document that cannot be loaded: every problem found, each with its JSON path. */
export class FlowValidationError extends Error {
    /** every problem found, each with its JSON path (RFC 6901) */
    readonly issues: readonly ValidationIssue[];

    constructor(issues: readonly ValidationIssue[]) {
        const [first] = issues;
        super(
            first
                ? `invalid flow document: ${first.path || "/"} ${first.message}${
                      issues.length > 1
                          ? ` (and ${issues.length - 1} more)`
                          : ""
                  }`
                : "invalid flow document",
        );
        this.name = "FlowValidationError";
        this.issues = issues;
    }
}
