// The contract of an opt-in feature (D2; guidelines architecture/features.md, data-grid's registry):
// a plain object a factory exported from the feature's own entry makes
// (`@fragiola/flow/selection` → `selection()`), installed on a model once, when it is created
// (`createFlowModel(json, { features: [selection()] })`). Every part is optional; the core composes
// them once (`registry.ts`) and calls each contribution point where it would have done the work
// itself. Features talk to each other only through keys, never by importing each other.

import type { MutablePartAttributes } from "../attributes/part-attributes";
import type { CommandDefinition, Failure } from "../commands/define";
import type {
    CommandListener,
    CommandName,
    CommandResult,
    RunOptions,
} from "../commands/types";
import type { FlowEdge, FlowNode, XY } from "../document/types";
import type { FlowHandle, PressTarget } from "../engine/adapter";
import type { FlowEngineEvent } from "../engine/events";
import type {
    EngineActionKey,
    EngineGetKey,
    EngineIsKey,
} from "../engine/verbs";
import type { EdgePath, Rect, Viewport } from "../geometry/types";
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

/** What the engine tells a gesture: the pointer moved, was released, or the gesture ends. */
export interface FeatureGesture {
    /** the pointer moved (its coalesced moves arrive one by one) */
    move(event: PointerEvent): void;
    /** the pointer was released: the gesture commits what it did */
    end(event: PointerEvent): void;
    /** the gesture ends without committing (Escape, `pointercancel`, a lost capture, a detach) */
    cancel(): void;
    /**
     * whether the gesture has started doing something (a drag past its threshold): a press whose
     * gesture is not active and that barely moved is a tap (`FeatureEngine.tap`)
     */
    active?(): boolean;
    /**
     * the gesture follows the pointer in the flow (a drag, a connection, a box, a resize): while it
     * is active and its pointer nears the root's edge, the engine pans the viewport every frame
     * (the `autoPan` option) and calls `move` again with the pointer's last event, so `move` must
     * read the flow point from the client point each time (`host.toFlow`), never from a delta
     * divided by the zoom
     */
    readonly autoPan?: boolean | undefined;
}

/**
 * What the engine gives the features of one view: the model, the view's means (the root, the
 * viewport, measured rects and handles, point conversion), its notifications and a shared slot.
 * Every member reads the engine at the call, never a snapshot.
 */
export interface FeatureEngineHost {
    readonly model: FeatureModel;
    /**
     * a value the features of this engine share, made by the first one that asks (a gesture
     * session): features share state through it without importing each other
     */
    shared<V>(key: string, create: () => V): V;
    /** the root element, when attached */
    root(): HTMLElement | undefined;
    /** the viewport */
    viewport(): Viewport;
    /** the least and the greatest zoom */
    zoomLimits(): { readonly min: number; readonly max: number };
    /** sets the viewport (zoom and translate extent kept); returns the viewport it got */
    setViewport(viewport: Viewport): Viewport;
    /** the root's size, in pixels (zero before it is attached and laid out) */
    rootSize(): { readonly width: number; readonly height: number };
    /** a pointer's client point (`clientX`, `clientY`) relative to the root's top-left corner */
    toRoot(client: XY): XY;
    /** a pointer's client point as a flow point */
    toFlow(client: XY): XY;
    /** a node's box in absolute flow coordinates with its measured (or given) size */
    nodeRect(nodeId: string): Rect | undefined;
    /** whether a node's size is known (measured, or given by the document) */
    measured(nodeId: string): boolean;
    /** every registered handle with its centre (absolute flow coordinates, once measured) */
    handles(): readonly FlowHandle[];
    /** an edge's drawn ends, once both its nodes are measured */
    edgePath(edgeId: string): EdgePath | undefined;
    /**
     * a node's position in absolute flow coordinates: its parent's box's top-left corner plus its
     * own position (with the `nodeOrigin`, the point of its box at that origin)
     */
    absolutePosition(nodeId: string): XY | undefined;
    /**
     * the position (relative to its parent) that puts a node's box of `size` with its top-left
     * corner at the absolute flow point `corner` (the `nodeOrigin` applied)
     */
    positionFor(
        nodeId: string,
        corner: XY,
        size: { readonly width: number; readonly height: number },
    ): XY;
    /**
     * the absolute rectangle a node's box stays inside: its parent's box with `extent: "parent"`
     * (measured), its rectangle `extent`, the engine's `nodeExtent`, together; none when unbound
     */
    extentOf(nodeId: string): Rect | undefined;
    /**
     * a node's position (relative to its parent) kept inside its extent (`extentOf`) with the
     * measured sizes; `size` overrides the node's own (a resize under way)
     */
    keepInExtent(
        nodeId: string,
        position: XY,
        size?: { readonly width: number; readonly height: number },
    ): XY;
    /**
     * whether a key is held during `event`: `Meta`, `Control`, `Alt` and `Shift` from the event's
     * flags, any other (`KeyboardEvent.key` or `.code`) from the keys held in the root's document
     */
    held(key: string, event: MouseEvent | KeyboardEvent): boolean;
    /** a node's element, as the adapter registered it */
    nodeElement(nodeId: string): HTMLElement | undefined;
    /** whether the flow's gestures and keys may change it (the Controls' interactivity toggle) */
    interactive(): boolean;
    /** options an adapter gave a part (`engine.adapter.setPartOptions`: a resizer's limits) */
    partOptions(
        part: string,
        id: string,
    ): Readonly<Record<string, unknown>> | undefined;
    /** the view changed (a gesture's state): adapters re-render */
    changed(): void;
    /** tells the app something happened (D12: an announcement's event) */
    emit(event: FlowEngineEvent): void;
}

/**
 * What a feature adds to one engine (each engine on a model gets its own). The engine walks the
 * hooks in install order, the first taking the event ending the walk, and merges the keys into its
 * verbs (a key two features add throws).
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
    /**
     * a primary press in the flow (`target` says on what): a gesture takes it (a drag, a
     * connection, a box selection starts), `undefined` leaves it to the next feature and the core
     */
    pointerdown?(
        event: PointerEvent,
        target: PressTarget,
    ): FeatureGesture | undefined;
    /**
     * a press released where it was pressed (no active gesture): `true` takes it (a click
     * selects); a gesture takes it and goes on without a press (a click-to-connect connection):
     * the engine moves it with the pointer, and the next press is its own (its release is the
     * gesture's `end`), as Escape, `cancel-gesture` and a detach are
     */
    tap?(
        event: PointerEvent,
        target: PressTarget,
    ): boolean | FeatureGesture | undefined;
    /** the wheel in the flow: `true` takes it (the minimap zooms) */
    wheel?(event: WheelEvent, target: PressTarget): boolean | undefined;
    /** a key in the flow: `true` takes it (its default is prevented) */
    keydown?(event: KeyboardEvent, target: PressTarget): boolean | undefined;
    /** DOM focus entered a part of the flow (a node, an edge) */
    focus?(target: PressTarget): void;
    /** adds its state attributes to a part's record (`data-dragging` on a dragged node) */
    attributes?(
        part: string,
        payload: Readonly<Record<string, unknown>>,
        into: MutablePartAttributes,
    ): void;
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

/** The `engine.run` actions of an engine whose model has the features `F`. */
export type EngineActionKeyOf<F extends FlowFeatures> = AllowedKeys<
    "engineRun",
    EngineActionKey,
    F
>;

/** The `engine.get` keys of an engine whose model has the features `F`. */
export type EngineGetKeyOf<F extends FlowFeatures> = AllowedKeys<
    "engineGet",
    EngineGetKey,
    F
>;

/** The `engine.is` keys of an engine whose model has the features `F`. */
export type EngineIsKeyOf<F extends FlowFeatures> = AllowedKeys<
    "engineIs",
    EngineIsKey,
    F
>;
