// What each opt-in feature owns, by name only (the tree's FEATURE_KEYS idea, fragiola/tree,
// packages/core/src/features/keys.ts, same author and licence): its commands, its `get` / `is`
// keys on the model and the engine, and its document fields on a node and on an edge. The core
// reads this table to refuse what belongs to a feature that is not installed (a `not_found`
// result, a document or payload issue naming the feature) and to type the verbs from the installed
// features. The payload and result types stay in the core's maps (types cost no bytes); the code of
// a feature lives only in its own entry (`@fragiola/flow/<feature>`), which nothing in the main
// entry imports. The engine names (`engineRun`, `engineGet`, `engineIs`) are the keys each
// feature's engine side adds to `engine.run` / `get` / `is` (fragiola/flow#3).

/** Every feature's keys and fields. */
export const FEATURE_KEYS = Object.freeze({
    selection: {
        commands: ["selection.set", "selection.clear", "selection.remove"],
        get: ["selected-nodes", "selected-edges"],
        is: ["node-selected", "edge-selected"],
        engineRun: [],
        engineGet: ["selection-box", "selection-rect"],
        engineIs: ["box-selecting"],
        nodeFields: ["selected"],
        edgeFields: ["selected"],
    },
    subflows: {
        commands: ["node.set-parent"],
        get: ["node-children-by", "node-parent-by"],
        is: [],
        engineRun: [],
        engineGet: [],
        engineIs: [],
        nodeFields: ["parentId", "extent", "expandParent"],
        edgeFields: [],
    },
    drag: {
        commands: [],
        get: [],
        is: [],
        engineRun: [],
        engineGet: ["dragging-node-ids"],
        engineIs: ["node-dragging", "dragging"],
        nodeFields: [],
        edgeFields: [],
    },
    resize: {
        commands: [],
        get: [],
        is: [],
        engineRun: [],
        engineGet: [],
        engineIs: ["node-resizing", "resizing"],
        nodeFields: [],
        edgeFields: [],
    },
    connection: {
        commands: [],
        get: [],
        is: [],
        engineRun: [],
        engineGet: ["connection"],
        engineIs: ["connecting"],
        nodeFields: [],
        edgeFields: [],
    },
    reconnection: {
        commands: ["edge.reconnect"],
        get: [],
        is: [],
        engineRun: [],
        engineGet: [],
        engineIs: ["edge-reconnecting"],
        nodeFields: [],
        edgeFields: [],
    },
    keyboard: {
        commands: [],
        get: [],
        is: [],
        engineRun: [],
        engineGet: [],
        engineIs: ["node-focusable", "edge-focusable"],
        nodeFields: [],
        edgeFields: [],
    },
    minimap: {
        commands: [],
        get: [],
        is: [],
        engineRun: [],
        engineGet: ["minimap-view", "minimap-point-to-flow"],
        engineIs: [],
        nodeFields: [],
        edgeFields: [],
    },
} as const);

/** The name of an opt-in feature (`@fragiola/flow/<name>`). */
export type FeatureName = keyof typeof FEATURE_KEYS;

/** The kinds of names a feature owns. */
export type FeatureKeyKind = keyof (typeof FEATURE_KEYS)[FeatureName];

/** The names of kind `K` the features `N` own. */
export type OwnedBy<
    K extends FeatureKeyKind,
    N extends FeatureName = FeatureName,
> = N extends FeatureName ? (typeof FEATURE_KEYS)[N][K][number] : never;

const owners = new Map<string, FeatureName>();
for (const [name, keys] of Object.entries(FEATURE_KEYS) as [
    FeatureName,
    (typeof FEATURE_KEYS)[FeatureName],
][]) {
    for (const [kind, list] of Object.entries(keys)) {
        for (const key of list as readonly string[]) {
            // a name two features owned would name the first one in a message
            if (!owners.has(`${kind}:${key}`)) {
                owners.set(`${kind}:${key}`, name);
            }
        }
    }
}

/** The feature that owns `key` of kind `kind`, if one does. */
export function ownerOf(
    kind: FeatureKeyKind,
    key: string,
): FeatureName | undefined {
    return owners.get(`${kind}:${key}`);
}

/** The message of a key or a field whose feature is not installed. */
export function requiresFeature(name: FeatureName): string {
    return `requires the ${name} feature (\`@fragiola/flow/${name}\`)`;
}
