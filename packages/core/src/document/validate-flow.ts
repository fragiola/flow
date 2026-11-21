import { composeFeatures } from "../features/registry";
import type { FlowFeatures } from "../features/types";
import type { ValidationIssue } from "../schema/types";
import { IdSource } from "./create-id";
import { loadDocument } from "./load-document";

/** What `validateFlow` checks against: the features the document will be loaded with. */
export interface ValidateFlowOptions {
    /** the features installed (a field of one not given is an issue); default none */
    features?: FlowFeatures | undefined;
}

/**
 * Every problem of a flow document, each with its JSON path, or none: what `createFlowModel`
 * would throw a `FlowValidationError` with. It never throws for a document (only for a features
 * list `createFlowModel` would refuse too: a feature twice, or one missing a requirement).
 */
export function validateFlow(
    json: unknown,
    options: ValidateFlowOptions = {},
): readonly ValidationIssue[] {
    const loaded = loadDocument(
        json,
        new IdSource(),
        composeFeatures(options.features),
        false,
    );
    return loaded.ok ? [] : loaded.issues;
}
