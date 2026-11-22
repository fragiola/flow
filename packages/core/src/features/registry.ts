// The registry (data-grid's, fragiola/data-grid, packages/core/src/feature/registry.ts, same
// author and licence): a model's features composed once, when it is created. Each contribution
// point is one function the core calls where it would have done the work itself; with no feature
// having it, it does nothing more. The engine (fragiola/flow#3) finds a model's composition through
// `featuresOf(model)`, never through the model's public surface, and composes the features' engine
// sides with `featureEngine`.

import type { MutablePartAttributes } from "../attributes/part-attributes";
import type { CommandDefinition, Failure } from "../commands/define";
import type { FlowEdge, FlowNode, XY } from "../document/types";
import type { PressTarget } from "../engine/adapter";
import type { ValidationIssue } from "../schema/types";
import type { Draft } from "../state/draft";
import {
    type FeatureKeyKind,
    type FeatureName,
    ownerOf,
    requiresFeature,
} from "./keys";
import type {
    AnyFlowFeature,
    FeatureEngine,
    FeatureEngineHost,
    FeatureGesture,
    FlowReader,
} from "./types";

/** A model's features, composed: what the model, its commands and its engines call. */
export interface ComposedFeatures {
    /** the features, as installed (fixed: the app's array changing later changes nothing) */
    readonly list: readonly AnyFlowFeature[];
    /** the installed features' names */
    readonly names: ReadonlySet<FeatureName>;
    /** their commands, by name */
    readonly commands: ReadonlyMap<string, CommandDefinition>;
    /** their `get` keys */
    readonly get: ReadonlyMap<
        string,
        (reader: FlowReader, payload: unknown) => unknown
    >;
    /** their `is` keys */
    readonly is: ReadonlyMap<
        string,
        (reader: FlowReader, payload: unknown) => boolean
    >;
    /** the feature that owns `key` of kind `kind` when it is not installed */
    missing(kind: FeatureKeyKind, key: string): FeatureName | undefined;
    /** the fields of `object` that belong to a feature not installed, as issues at `path` */
    missingFields(
        kind: "nodeFields" | "edgeFields",
        object: object,
        path: string,
    ): ValidationIssue[];
    documentIssues(reader: FlowReader): ValidationIssue[];
    checkNode(draft: Draft, node: FlowNode, path: string): Failure | undefined;
    checkEdge(draft: Draft, edge: FlowEdge, path: string): Failure | undefined;
    removing(draft: Draft, nodeIds: Set<string>): void;
    constrainPosition(draft: Draft, node: FlowNode, position: XY): XY;
    nodeChanged(draft: Draft, nodeId: string): void;
    flagsChanged(draft: Draft, kind: "node" | "edge", id: string): void;
    absolutePosition(reader: FlowReader, node: FlowNode): XY;
}

/** The installed features that have a contribution point. */
function having<K extends keyof AnyFlowFeature>(
    list: readonly AnyFlowFeature[],
    key: K,
): readonly AnyFlowFeature[] {
    return list.filter((feature) => feature[key] !== undefined);
}

/** A feature's keys of one kind into the model's: a key two features add throws. */
function collect<V>(
    feature: AnyFlowFeature,
    kind: string,
    entries: Readonly<Record<string, unknown>> | undefined,
    into: Map<string, V>,
): void {
    for (const [key, value] of Object.entries(entries ?? {})) {
        if (into.has(key)) {
            throw new TypeError(
                `feature "${feature.name}" adds the ${kind} "${key}", which another feature adds`,
            );
        }
        into.set(key, value as V);
    }
}

/**
 * Composes a list of features, once: it throws for a feature installed twice, or one missing a
 * requirement (`feature "reconnection" requires feature "connection": install it too`).
 */
export function composeFeatures(
    features: readonly AnyFlowFeature[] = [],
): ComposedFeatures {
    const list = Object.freeze([...features]);
    const names = new Set<FeatureName>();
    for (const feature of list) {
        if (names.has(feature.name)) {
            throw new TypeError(
                `feature "${feature.name}" is installed twice: install it once`,
            );
        }
        names.add(feature.name);
    }
    for (const feature of list) {
        for (const required of feature.requires ?? []) {
            if (!names.has(required)) {
                throw new TypeError(
                    `feature "${feature.name}" requires feature "${required}": install it too`,
                );
            }
        }
    }
    const commands = new Map<string, CommandDefinition>();
    const get = new Map<
        string,
        (reader: FlowReader, payload: unknown) => unknown
    >();
    const is = new Map<
        string,
        (reader: FlowReader, payload: unknown) => boolean
    >();
    for (const feature of list) {
        collect(
            feature,
            "command",
            Object.fromEntries(
                (feature.commands ?? []).map((command) => [
                    command.name,
                    command,
                ]),
            ),
            commands,
        );
        collect(feature, "get key", feature.get, get);
        collect(feature, "is key", feature.is, is);
    }
    const issuers = having(list, "documentIssues");
    const checkers = having(list, "checkNode");
    const edgeCheckers = having(list, "checkEdge");
    const removers = having(list, "removing");
    const constrainers = having(list, "constrainPosition");
    const followers = having(list, "nodeChanged");
    const flagWatchers = having(list, "flagsChanged");
    const positioner = list.find((feature) => feature.absolutePosition);

    const missing = (kind: FeatureKeyKind, key: string) => {
        const owner = ownerOf(kind, key);
        return owner !== undefined && !names.has(owner) ? owner : undefined;
    };

    return Object.freeze({
        list,
        names,
        commands,
        get,
        is,
        missing,
        missingFields: (kind, object, path) =>
            Object.keys(object).flatMap((key) => {
                const owner = missing(kind, key);
                return owner === undefined
                    ? []
                    : [
                          {
                              path: `${path}/${key}`,
                              message: requiresFeature(owner),
                          },
                      ];
            }),
        documentIssues: (reader) =>
            issuers.flatMap(
                (feature) => feature.documentIssues?.(reader) ?? [],
            ),
        checkNode: (draft, node, path) => {
            for (const feature of checkers) {
                const failure = feature.checkNode?.(draft, node, path);
                if (failure) {
                    return failure;
                }
            }
            return undefined;
        },
        checkEdge: (draft, edge, path) => {
            for (const feature of edgeCheckers) {
                const failure = feature.checkEdge?.(draft, edge, path);
                if (failure) {
                    return failure;
                }
            }
            return undefined;
        },
        removing: (draft, nodeIds) => {
            for (const feature of removers) {
                feature.removing?.(draft, nodeIds);
            }
        },
        constrainPosition: (draft, node, position) => {
            let kept = position;
            for (const feature of constrainers) {
                kept = feature.constrainPosition?.(draft, node, kept) ?? kept;
            }
            return kept;
        },
        nodeChanged: (draft, nodeId) => {
            for (const feature of followers) {
                feature.nodeChanged?.(draft, nodeId);
            }
        },
        flagsChanged: (draft, kind, id) => {
            for (const feature of flagWatchers) {
                feature.flagsChanged?.(draft, kind, id);
            }
        },
        absolutePosition: (reader, node) =>
            positioner?.absolutePosition?.(reader, node) ?? node.position,
    } satisfies ComposedFeatures);
}

/** No feature: a bare flow. */
export const NO_FEATURES: ComposedFeatures = composeFeatures([]);

/** The composed features of each model (`featuresOf`): the model's surface stays its verbs. */
const byModel = new WeakMap<object, ComposedFeatures>();

/** Records a model's composed features (`createFlowModel`). */
export function registerFeatures(
    model: object,
    features: ComposedFeatures,
): void {
    byModel.set(model, features);
}

/** A model's composed features (a bare flow's for an object that is not a model). */
export function featuresOf(model: object): ComposedFeatures {
    return byModel.get(model) ?? NO_FEATURES;
}

/** Every installed feature's engine side in one engine, composed: each list walked in install order. */
export interface ComposedFeatureEngine {
    readonly list: readonly FeatureEngine[];
    readonly run: ReadonlyMap<
        string,
        NonNullable<FeatureEngine["run"]>[string]
    >;
    readonly get: ReadonlyMap<
        string,
        NonNullable<FeatureEngine["get"]>[string]
    >;
    readonly is: ReadonlyMap<string, NonNullable<FeatureEngine["is"]>[string]>;
    /** the gesture of the first feature that takes a press, if one does */
    pointerdown(
        event: PointerEvent,
        target: PressTarget,
    ): FeatureGesture | undefined;
    /** the first feature whose hook takes a tap: whether one did, or the gesture it started */
    tap(event: PointerEvent, target: PressTarget): boolean | FeatureGesture;
    /** the first feature whose hook takes the wheel: whether one did */
    wheel(event: WheelEvent, target: PressTarget): boolean;
    /** the first feature whose hook takes a key: whether one did, or the gesture it started */
    keydown(
        event: KeyboardEvent,
        target: PressTarget,
    ): boolean | FeatureGesture;
    focus(target: PressTarget): void;
    attributes(
        part: string,
        payload: Readonly<Record<string, unknown>>,
        into: MutablePartAttributes,
    ): void;
    attached(root: Element): void;
    detached(): void;
    destroy(): void;
}

/**
 * Every installed feature's engine side, made once for one engine with what it hands them
 * (fragiola/flow#3): their keys merged (a key two features add throws), their hooks in install
 * order.
 */
export function featureEngine(
    features: ComposedFeatures,
    host: FeatureEngineHost,
): ComposedFeatureEngine {
    const owners: AnyFlowFeature[] = [];
    const list: FeatureEngine[] = [];
    for (const feature of features.list) {
        if (feature.engine) {
            owners.push(feature);
            list.push(feature.engine(host));
        }
    }
    const run = new Map<string, NonNullable<FeatureEngine["run"]>[string]>();
    const get = new Map<string, NonNullable<FeatureEngine["get"]>[string]>();
    const is = new Map<string, NonNullable<FeatureEngine["is"]>[string]>();
    list.forEach((engine, i) => {
        const owner = owners[i] as AnyFlowFeature;
        collect(owner, "engine action", engine.run, run);
        collect(owner, "engine get key", engine.get, get);
        collect(owner, "engine is key", engine.is, is);
    });
    return {
        list,
        run,
        get,
        is,
        pointerdown: (event, target) => {
            for (const engine of list) {
                const gesture = engine.pointerdown?.(event, target);
                if (gesture) return gesture;
            }
            return undefined;
        },
        tap: (event, target) => {
            for (const engine of list) {
                const taken = engine.tap?.(event, target);
                if (taken === true || (taken && typeof taken === "object")) {
                    return taken;
                }
            }
            return false;
        },
        wheel: (event, target) =>
            list.some((engine) => engine.wheel?.(event, target) === true),
        keydown: (event, target) => {
            for (const engine of list) {
                const taken = engine.keydown?.(event, target);
                if (taken === true || (taken && typeof taken === "object")) {
                    return taken;
                }
            }
            return false;
        },
        focus: (target) => {
            for (const engine of list) engine.focus?.(target);
        },
        attributes: (part, payload, into) => {
            for (const engine of list) engine.attributes?.(part, payload, into);
        },
        attached: (root) => {
            for (const engine of list) engine.attached?.(root);
        },
        detached: () => {
            for (const engine of list) engine.detached?.();
        },
        destroy: () => {
            for (const engine of list) engine.destroy?.();
        },
    };
}
