// The contract of an opt-in feature (D2; guidelines architecture/features.md, data-grid's registry):
// a plain object a factory exported from the feature's own entry makes
// (`@fragiola/flow/selection` → `selection()`), installed on a model once, when it is created
// (`createFlowModel(json, { features: [selection()] })`). Every part is optional; the core composes
// them once (`registry.ts`) and calls each contribution point where it would have done the work
// itself. Features talk to each other only through keys, never by importing each other.
import type { CommandDefinition, Failure } from "../commands/define";
import type {
    CommandListener,
    CommandName,
    CommandResult,
    RunOptions,
} from "../commands/types";
import type { FlowEdge, FlowNode, XY } from "../document/types";
import type { ValidationIssue } from "../schema/types";
import type { Draft } from "../state/draft";
import type { ModelGetKey, ModelIsKey } from "../state/queries";
import type { FeatureKeyKind, FeatureName, OwnedBy } from "./keys";

export type { FeatureName } from "./keys";

/** What a feature reads of a document: its nodes and edges, in order and by id. */
export interface FlowReader {
    nodes(): readonly FlowNode[];
    edges(): readonly FlowEdge[];
    node(id: string): FlowNode | undefined;
    edge(id: string): FlowEdge | undefined;
}

/**
 * The model as a feature's engine side uses it (fragiola/flow#3): the verbs, typed loosely, since
 * a feature works on a model of any registry.
 */
export interface FeatureModel {
    run(
        command: CommandName,
        payload: object,
        options?: RunOptions,
    ): CommandResult<unknown>;
    can(command: CommandName, payload: object, options?: RunOptions): boolean;
    check(
        command: CommandName,
        payload: object,
        options?: RunOptions,
    ): CommandResult<unknown>;
    get(key: ModelGetKey, payload?: object): unknown;
    is(key: ModelIsKey, payload: object): boolean;
    subscribe(listener: CommandListener): () => void;
}

/**
 * What an engine gives the features of one view (fragiola/flow#3 adds its DOM means here: the
 * root, measured rects, handles, the viewport, events).
 */
export interface FeatureEngineHost {
    readonly model: FeatureModel;
    /**
     * a value the features of this engine share, made by the first one that asks (a gesture
     * session): features share state through it without importing each other
     */
    shared<V>(key: string, create: () => V): V;
}

/**
 * What a feature adds to one engine (each engine on a model gets its own). The engine
 * (fragiola/flow#3) walks the hooks in install order, the first returning `true` taking the event,
 * and merges the keys into its verbs (a key two features add throws).
 */
export interface FeatureEngine {
    /** engine actions (`engine.run`), each with its dry run */
    readonly run?:
        | Readonly<
              Record<
                  string,
                  (payload: unknown, dryRun: boolean) => CommandResult<unknown>
              >
          >
        | undefined;
    /** engine reads (`engine.get`) */
    readonly get?:
        | Readonly<Record<string, (payload: unknown) => unknown>>
        | undefined;
    /** engine questions (`engine.is`) */
    readonly is?:
        | Readonly<Record<string, (payload: unknown) => boolean>>
        | undefined;
    /** a primary press in the flow: `true` takes it (a drag, a connection, a box selection starts) */
    pointerdown?(event: PointerEvent): boolean | undefined;
    /** a key in the flow: `true` takes it */
    keydown?(event: KeyboardEvent): boolean | undefined;
    /** the root element was attached */
    attached?(root: Element): void;
    /** the root goes away: what is under way (a gesture) ends */
    detached?(): void;
    /** the engine is destroyed */
    destroy?(): void;
}

/**
 * An opt-in feature: its options, commands, keys, document rules and engine side. `N` is its name
 * (`FEATURE_KEYS`), `O` its options as its factory resolved them (read by its engine side).
 */
export interface FlowFeature<
    N extends FeatureName = FeatureName,
    O extends object = object,
> {
    readonly name: N;
    /** features it needs installed too; a missing one fails `createFlowModel`, naming both */
    readonly requires?: readonly FeatureName[] | undefined;
    /** its options, with their defaults, frozen */
    readonly options: Readonly<O>;
    /** its commands, on the same bus as the core's */
    readonly commands?: readonly CommandDefinition[] | undefined;
    /** its `model.get` keys */
    readonly get?:
        | {
              readonly [key: string]: (
                  reader: FlowReader,
                  payload: never,
              ) => unknown;
          }
        | undefined;
    /** its `model.is` keys */
    readonly is?:
        | {
              readonly [key: string]: (
                  reader: FlowReader,
                  payload: never,
              ) => boolean;
          }
        | undefined;
    /** the rules of its document fields past the JSON Schema (references, cycles), with their paths */
    documentIssues?(reader: FlowReader): ValidationIssue[];
    /** a node `node.add` is about to add: why it cannot be (at `path`), or `undefined` */
    checkNode?(draft: Draft, node: FlowNode, path: string): Failure | undefined;
    /** an edge `edge.add` is about to add: why it cannot be (at `path`), or `undefined` */
    checkEdge?(draft: Draft, edge: FlowEdge, path: string): Failure | undefined;
    /** nodes are about to be removed: adds the nodes that go with them (a parent's children) */
    removing?(draft: Draft, nodeIds: Set<string>): void;
    /** where a node may be put (`node.add`, `node.move`, `node.resize`): the position kept to its rules */
    constrainPosition?(draft: Draft, node: FlowNode, position: XY): XY;
    /** a node was added, moved or resized: what follows it (a parent that grows) */
    nodeChanged?(draft: Draft, nodeId: string): void;
    /** a node's or an edge's flags changed (`node.set-flags`, `edge.set-flags`) */
    flagsChanged?(draft: Draft, kind: "node" | "edge", id: string): void;
    /** a node's position in flow coordinates, whatever it is relative to (a parent's) */
    absolutePosition?(reader: FlowReader, node: FlowNode): XY;
    /** its part of each engine (fragiola/flow#3) */
    engine?(host: FeatureEngineHost): FeatureEngine;
}

/** Any feature. */
export type AnyFlowFeature = FlowFeature<FeatureName, object>;

/**
 * A list of installed features (`createFlowModel`'s `features`). As a type argument, this wide
 * form means "any features": every feature's keys are allowed, and a model with features is
 * assignable to it, so a function taking `FlowModel<T>` takes any model.
 */
export type FlowFeatures = readonly AnyFlowFeature[];

/** The names of the features of a list. */
export type FeatureNamesOf<F extends FlowFeatures> = F[number]["name"];

/** The names of kind `Kind` among `All` that a model with the features `F` has: the core's and theirs. */
export type AllowedKeys<
    Kind extends FeatureKeyKind,
    All extends string,
    F extends FlowFeatures,
> =
    | Exclude<All, OwnedBy<Kind>>
    | Extract<All, OwnedBy<Kind, FeatureNamesOf<F>>>;

/** The commands a model with the features `F` runs. */
export type CommandNameOf<F extends FlowFeatures> = AllowedKeys<
    "commands",
    CommandName,
    F
>;

/** The `model.get` keys of a model with the features `F`. */
export type ModelGetKeyOf<F extends FlowFeatures> = AllowedKeys<
    "get",
    ModelGetKey,
    F
>;

/** The `model.is` keys of a model with the features `F`. */
export type ModelIsKeyOf<F extends FlowFeatures> = AllowedKeys<
    "is",
    ModelIsKey,
    F
>;
