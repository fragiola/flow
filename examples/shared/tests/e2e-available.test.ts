// From Splitter (fragiola/splitter, examples/shared/tests/e2e-available.test.ts), same author and licence.
import { describe, expect, it } from "vitest";
import {
    COMPLETE_FRAMEWORKS,
    caseSkipReason,
    embedBase,
    frameworkOf,
    PENDING,
    pendingCase,
    skipOrFail,
    skipReason,
} from "../e2e/available.ts";
import { listMetaSlugs } from "../scripts/examples-lib.ts";
import type { Framework } from "../src/framework.ts";

// The shared e2e suite runs against every framework's embed; a spec that opens an example the
// framework does not have is skipped with this reason, unless the framework ships every example
// (e2e/helpers.ts).
describe("the e2e suite's framework", () => {
    it("comes from EXAMPLES_FRAMEWORK, and a missing or unknown one throws", () => {
        expect(frameworkOf("vue")).toBe("vue");
        expect(() => frameworkOf(undefined)).toThrow(/EXAMPLES_FRAMEWORK/);
        expect(() => frameworkOf("solid")).toThrow(
            /react, vue, svelte, angular/,
        );
    });

    it("mounts each framework's embed under its own base", () => {
        expect(embedBase("react")).toBe("/flow/embed/react/");
        expect(embedBase("angular")).toBe("/flow/embed/angular/");
    });
});

describe("a spec's examples", () => {
    const available = ["basic", "workflow-builder"];

    it("run when the framework has every one", () => {
        expect(skipReason("vue", available, ["basic"])).toBeUndefined();
        expect(skipReason("vue", available, [])).toBeUndefined();
    });

    it("skip, naming the missing ones, when it lacks some", () => {
        expect(
            skipReason("vue", available, [
                "workflow-builder",
                "toolbox",
                "keyboard",
            ]),
        ).toBe("vue has no toolbox, keyboard example");
    });
});

describe("a complete framework", () => {
    const available = ["basic"];

    it("is every framework today: React, Vue, Svelte and Angular", () => {
        expect([...COMPLETE_FRAMEWORKS]).toEqual([
            "react",
            "vue",
            "svelte",
            "angular",
        ]);
    });

    it("fails a spec whose example it lacks, instead of skipping it", () => {
        expect(() =>
            skipOrFail("react", available, ["workflow-builder"]),
        ).toThrow(
            /react has no workflow-builder example, but every react example is required/,
        );
        expect(skipOrFail("react", available, ["basic"])).toBeUndefined();
        expect(() =>
            skipOrFail("vue", available, ["workflow-builder"]),
        ).toThrow(/every vue example is required/);
        expect(() =>
            skipOrFail("svelte", available, ["workflow-builder"]),
        ).toThrow(/every svelte example is required/);
        expect(() =>
            skipOrFail("angular", available, ["workflow-builder"]),
        ).toThrow(/every angular example is required/);
    });

    it("skips a spec in a framework still being written", () => {
        // no framework is incomplete today: a framework of a later adapter Epic, before its app
        // has every example
        const writing = "solid" as Framework;
        expect(skipOrFail(writing, available, ["workflow-builder"])).toBe(
            "solid has no workflow-builder example",
        );
    });
});

describe("what is pending in a complete framework", () => {
    const available = ["basic"];

    it("skips a pending example instead of failing", () => {
        expect(
            skipOrFail(
                "vue",
                available,
                ["workflow-builder"],
                ["workflow-builder"],
            ),
        ).toBe("vue has no workflow-builder example yet (PENDING)");
        expect(() =>
            skipOrFail("vue", available, ["workflow-builder", "x"], ["x"]),
        ).toThrow(/every vue example is required/);
    });

    it("skips a pending case of a spec, and runs every other", () => {
        const pending = [pendingCase("sub-flows", "selection-grouping")];
        expect(
            caseSkipReason(
                "svelte",
                "sub-flows",
                "selection-grouping",
                pending,
            ),
        ).toBe("svelte has no sub-flows#selection-grouping yet (PENDING)");
        expect(
            caseSkipReason("svelte", "sub-flows", "other", pending),
        ).toBeUndefined();
    });

    it("is nothing in React, where every example is written first", () => {
        expect(PENDING.react).toEqual([]);
    });

    it("names only examples that exist", () => {
        const slugs = new Set(listMetaSlugs());
        for (const [framework, entries] of Object.entries(PENDING)) {
            for (const entry of entries) {
                const slug = entry.split("#")[0] ?? "";
                expect(slugs.has(slug), `${framework}: ${entry}`).toBe(true);
            }
        }
    });
});
