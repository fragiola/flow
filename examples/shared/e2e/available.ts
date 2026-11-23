// From Splitter (fragiola/splitter, examples/shared/e2e/available.ts), same author and licence.
// Which framework an e2e run tests, and which of its examples a spec may open. Free of Playwright,
// so the unit tests check it (tests/e2e-available.test.ts).
//
// One suite for every framework: each app's playwright.config.ts (`examplesE2eConfig`) sets
// `EXAMPLES_FRAMEWORK`, and a spec that opens an example the framework does not have is skipped,
// not failed: a framework may ship a subset of the examples (contract §5) while it is being
// written. A framework of `COMPLETE_FRAMEWORKS` ships every example: a missing one fails, unless
// `PENDING` names it for that framework (an example, or one case of a spec, that a later Epic
// brings to it).

import { FRAMEWORKS, type Framework, isFramework } from "../src/framework.ts";

/**
 * The frameworks whose app has every example: for them, a spec never skips. Every framework of
 * `FRAMEWORKS` today (Angular since #16); a framework added later joins once its app has every
 * example.
 */
export const COMPLETE_FRAMEWORKS: readonly Framework[] = [
    "react",
    "vue",
    "svelte",
    "angular",
];

/** The pending case of an example's spec: `<slug>#<case>` (a whole example is its `<slug>`). */
export function pendingCase(slug: string, name: string): string {
    return `${slug}#${name}`;
}

/**
 * What a framework's app does not have yet, because a later Epic brings it there: whole examples
 * (`<slug>`) and cases of an example's spec (`<slug>#<case>`, `pendingCase`). A spec that needs
 * one is skipped in that framework instead of failing, with a reason that says it is pending. The
 * Epic that ports it to a framework removes it from that framework's list; React, where every
 * example is written first, never has any (`tests/e2e-available.test.ts`).
 */
export const PENDING: Readonly<Record<Framework, readonly string[]>> = {
    react: [],
    // Epic #49 (#44): the extensions of edge-reconnect and sub-flows, React first
    vue: [
        pendingCase("edge-reconnect", "delete-on-drop"),
        pendingCase("sub-flows", "selection-grouping"),
        // Epic #49 (#45): new React examples, ported by a later Epic
        "shapes",
        "easy-connect",
        "proximity-connect",
        "delete-middle-node",
        "intersections",
        "contextual-zoom",
        "connection-line",
    ],
    svelte: [
        pendingCase("edge-reconnect", "delete-on-drop"),
        pendingCase("sub-flows", "selection-grouping"),
        // Epic #49 (#45): new React examples, ported by a later Epic
        "shapes",
        "easy-connect",
        "proximity-connect",
        "delete-middle-node",
        "intersections",
        "contextual-zoom",
        "connection-line",
    ],
    angular: [
        pendingCase("edge-reconnect", "delete-on-drop"),
        pendingCase("sub-flows", "selection-grouping"),
        // Epic #49 (#45): new React examples, ported by a later Epic
        "shapes",
        "easy-connect",
        "proximity-connect",
        "delete-middle-node",
        "intersections",
        "contextual-zoom",
        "connection-line",
    ],
};

/** The framework of `EXAMPLES_FRAMEWORK`; anything else throws (a config that forgot to set it). */
export function frameworkOf(value: string | undefined): Framework {
    if (!isFramework(value)) {
        throw new Error(
            `EXAMPLES_FRAMEWORK must be one of ${FRAMEWORKS.join(", ")} (got ${JSON.stringify(value)}): run the suite through an app's playwright.config.ts`,
        );
    }
    return value;
}

/** Where the e2e server mounts a framework's embed, as `site:export --base /flow` does. */
export function embedBase(framework: Framework): string {
    return `/flow/embed/${framework}/`;
}

/**
 * Why a test that needs `slugs` cannot run in `framework` (its app has none of some of them), or
 * nothing when it can.
 */
export function skipReason(
    framework: Framework,
    available: readonly string[],
    slugs: readonly string[],
): string | undefined {
    const missing = slugs.filter((slug) => !available.includes(slug));
    return missing.length === 0
        ? undefined
        : `${framework} has no ${missing.join(", ")} example`;
}

/**
 * Why a test that needs `slugs` is skipped in `framework`, or nothing when it runs. Throws when
 * the framework is one of `COMPLETE_FRAMEWORKS` and lacks one of them: the test fails instead.
 */
export function skipOrFail(
    framework: Framework,
    available: readonly string[],
    slugs: readonly string[],
    pending: readonly string[] = PENDING[framework] ?? [],
): string | undefined {
    const reason = skipReason(framework, available, slugs);
    if (reason === undefined || !COMPLETE_FRAMEWORKS.includes(framework)) {
        return reason;
    }
    const missing = slugs.filter((slug) => !available.includes(slug));
    if (missing.every((slug) => pending.includes(slug))) {
        return `${reason} yet (PENDING)`;
    }
    throw new Error(
        `${reason}, but every ${framework} example is required (COMPLETE_FRAMEWORKS)`,
    );
}

/**
 * Why one case of an example's spec is skipped in `framework` (`PENDING` names it there), or
 * nothing when it runs.
 */
export function caseSkipReason(
    framework: Framework,
    slug: string,
    name: string,
    pending: readonly string[] = PENDING[framework] ?? [],
): string | undefined {
    return pending.includes(pendingCase(slug, name))
        ? `${framework} has no ${pendingCase(slug, name)} yet (PENDING)`
        : undefined;
}
