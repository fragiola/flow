// The commands' types (D6): every command's payload and result, the core's and the features'
// (types cost no bytes: a feature's code stays in its entry, its types are here), the results and
// errors, the middleware and the events. Names are `<entity>.<verb>`; an id field is `<entity>Id`.
import type {
    AnyTypes,
    EdgeDataOf,
    EdgeTypeOf,
    FlowDocument,
    FlowEdgeInput,
    FlowNodeInput,
    FlowTypes,
    NodeDataOf,
    NodeTypeOf,
    XY,
} from "../document/types";
import type { FeatureName } from "../features/keys";
import type { CommandNameOf, FlowFeatures } from "../features/types";
import type { Rect } from "../geometry/types";
import type { JsonSchema, ValidationIssue } from "../schema/types";

/** A shallow patch of data `D`: some of its top-level keys (any keys when `D` is not typed). */
type PatchOf<D> = unknown extends D
    ? Record<string, unknown>
    : D extends object
      ? Partial<D>
      : never;

/** A shallow patch of a node's data in the registry `T`: some top-level keys of one type's data. */
export type NodeDataPatchOf<T extends FlowTypes> = {
    [K in NodeTypeOf<T>]: PatchOf<NodeDataOf<T, K>>;
}[NodeTypeOf<T>];

/** A shallow patch of an edge's data in the registry `T`: some top-level keys of one type's data. */
export type EdgeDataPatchOf<T extends FlowTypes> = {
    [K in EdgeTypeOf<T>]: PatchOf<EdgeDataOf<T, K>>;
}[EdgeTypeOf<T>];

/** The flags `node.set-flags` sets: each one given is written, the others stay. */
export interface NodeFlagsPayload {
    nodeId: string;
    draggable?: boolean;
    selectable?: boolean;
    connectable?: boolean;
    deletable?: boolean;
    hidden?: boolean;
}

/** The flags `edge.set-flags` sets: each one given is written, the others stay. */
export interface EdgeFlagsPayload {
    edgeId: string;
    selectable?: boolean;
    deletable?: boolean;
    hidden?: boolean;
    reconnectable?: boolean;
}

/** Where an edge goes: its nodes and, optionally, their handles. */
export interface ConnectionPayload {
    source: string;
    target: string;
    sourceHandle?: string;
    targetHandle?: string;
}

/** How `selection.set` combines its ids with the selection: replace it (default), add, toggle. */
export type SelectionMode = "replace" | "add" | "toggle";

/** What a removal took away: the nodes, and every edge that touched them or was removed itself. */
export interface RemovedResult {
    removedNodeIds: string[];
    removedEdgeIds: string[];
}

/** The ids selected (or deselected) by a selection command. */
export interface SelectionResult {
    nodeIds: string[];
    edgeIds: string[];
}

/** One command of a batch. */
export type BatchEntry<T extends FlowTypes = AnyTypes> = {
    [C in CommandName]: { command: C; payload: PayloadOf<T, C> };
}[CommandName];

/** Every command, the core's and the features': its payload and its result, typed by `T`. */
export interface CommandMap<T extends FlowTypes = AnyTypes> {
    "node.add": { payload: FlowNodeInput<T>; result: { nodeId: string } };
    "node.remove": { payload: { nodeId: string }; result: RemovedResult };
    "node.move": {
        payload: { nodeId: string; position: XY };
        result: { nodeId: string; position: XY };
    };
    "node.resize": {
        payload: {
            nodeId: string;
            width: number;
            height: number;
            position?: XY;
        };
        result: { nodeId: string; width: number; height: number; position: XY };
    };
    "node.set-data": {
        payload: { nodeId: string; data: NodeDataPatchOf<T> };
        result: { nodeId: string };
    };
    "node.set-flags": { payload: NodeFlagsPayload; result: { nodeId: string } };
    "node.set-parent": {
        payload: {
            nodeId: string;
            parentId: string | null;
            extent?: "parent" | Rect | null;
            expandParent?: boolean;
        };
        result: { nodeId: string; position: XY };
    };
    "edge.add": { payload: FlowEdgeInput<T>; result: { edgeId: string } };
    "edge.remove": { payload: { edgeId: string }; result: { edgeId: string } };
    "edge.reconnect": {
        payload: { edgeId: string } & ConnectionPayload;
        result: { edgeId: string };
    };
    "edge.set-data": {
        payload: { edgeId: string; data: EdgeDataPatchOf<T> };
        result: { edgeId: string };
    };
    "edge.set-flags": { payload: EdgeFlagsPayload; result: { edgeId: string } };
    "selection.set": {
        payload: {
            nodeIds?: string[];
            edgeIds?: string[];
            mode?: SelectionMode;
        };
        result: SelectionResult;
    };
    "selection.clear": {
        payload: Record<never, never>;
        result: SelectionResult;
    };
    "selection.remove": {
        payload: Record<never, never>;
        result: RemovedResult;
    };
    batch: {
        payload: { commands: BatchEntry<T>[] };
        result: { results: unknown[] };
    };
}

/** The name of a command, the core's or a feature's. */
export type CommandName = keyof CommandMap;

/** The payload of command `C`. */
export type PayloadOf<
    T extends FlowTypes,
    C extends CommandName,
> = CommandMap<T>[C]["payload"];

/** The result of command `C`. */
export type ResultOf<
    T extends FlowTypes,
    C extends CommandName,
> = CommandMap<T>[C]["result"];

/** Why a command did not apply. */
export type CommandErrorCode =
    /** no command has this name */
    | "unknown_command"
    /** the payload does not match the command's schema, or names a field of a feature not installed */
    | "invalid_payload"
    /** a node or edge the payload names does not exist, or the command's feature is not installed */
    | "not_found"
    /** a rule of the flow forbids it (a permission flag, a duplicate edge, a parent cycle, …) */
    | "refused"
    /** a middleware vetoed it */
    | "vetoed"
    /** it was issued from a middleware and will run after the current command */
    | "queued"
    /** a middleware threw */
    | "middleware_error";

/** Why a command did not apply: a code, a message, and where (a JSON pointer into the payload). */
export interface CommandError {
    readonly code: CommandErrorCode;
    readonly message: string;
    /** a JSON pointer into the payload (or the dispatched input) */
    readonly path?: string;
    /** every schema problem, for `invalid_payload` */
    readonly issues?: readonly ValidationIssue[];
}

/** What a command returns: its value, or why it did not apply. It never throws on bad input. */
export type CommandResult<R> =
    | { readonly ok: true; readonly value: R }
    | { readonly ok: false; readonly error: CommandError };

/** Options of `run`, `can` and `check`. */
export interface RunOptions {
    /** a step of a continuous gesture (a drag): the event is marked so undo can merge it */
    transient?: boolean;
    /** free-form information for middleware and listeners */
    meta?: Readonly<Record<string, unknown>>;
}

/** What a middleware's `ctx.get` reads: each key's payload and result, as on `model.get`. */
export interface CommandContextGetMap<T extends FlowTypes = AnyTypes> {
    /** a node by its id */
    "node-by": {
        payload: { id: string };
        result: FlowDocument<T>["nodes"][number] | undefined;
    };
    /** an edge by its id */
    "edge-by": {
        payload: { id: string };
        result: FlowDocument<T>["edges"][number] | undefined;
    };
}

/** What a middleware's `ctx.get` reads. */
export type CommandContextGetKey = keyof CommandContextGetMap;

/** What a middleware sees of any command. */
export interface CommandContextBase<T extends FlowTypes = AnyTypes> {
    /** `model.can`/`model.check` (and a drag's hover): nothing will be committed; cause no side effects */
    readonly dryRun: boolean;
    readonly transient: boolean;
    /** true for a command running inside a batch (the batch itself also passes the chain) */
    readonly inBatch: boolean;
    readonly meta: Readonly<Record<string, unknown>> | undefined;
    /** the committed document the command applies to */
    readonly state: FlowDocument<T>;
    /** reads a node or an edge as the command sees it: inside a batch, after its earlier commands */
    get<K extends CommandContextGetKey>(
        key: K,
        payload: CommandContextGetMap<T>[K]["payload"],
    ): CommandContextGetMap<T>[K]["result"];
}

/**
 * What a middleware sees: a union discriminated by `command`, so checking the command narrows the
 * payload (`if (ctx.command === "edge.add") ctx.payload.source`). Only the commands of the
 * installed features `F` are in it.
 */
export type CommandContext<
    T extends FlowTypes = AnyTypes,
    F extends FlowFeatures = FlowFeatures,
> = ContextOf<T, CommandNameOf<F>>;

/**
 * The context of each command of `C` (a distributive conditional, not a mapped type over the
 * names: a model with features then stays assignable to a model of any features).
 */
type ContextOf<
    T extends FlowTypes,
    C extends CommandName,
> = C extends CommandName
    ? CommandContextBase<T> & {
          readonly command: C;
          /** the validated payload; assign a new object to rewrite it (it is validated again) */
          payload: PayloadOf<T, C>;
      }
    : never;

/**
 * Runs around every command, engine-issued or not: veto (return an error without calling
 * `next`), rewrite (assign `ctx.payload`, then call `next`) or observe (call `next` and look at its
 * result). Returning `undefined` passes on `next`'s result when it was called. (Spelled as a
 * method: its parameters compare both ways, so a model with features is a model.)
 */
export type Middleware<
    T extends FlowTypes = AnyTypes,
    F extends FlowFeatures = FlowFeatures,
> = {
    middleware(
        ctx: CommandContext<T, F>,
        next: () => CommandResult<unknown>,
    ): CommandResult<unknown> | undefined;
}["middleware"];

/** One command of a batch, as its event reports it. */
export interface BatchStep {
    readonly command: CommandName;
    readonly payload: unknown;
    readonly result: unknown;
}

/** What a listener receives: one event per commit. */
export interface CommandEvent<T extends FlowTypes = AnyTypes> {
    readonly command: CommandName;
    /** the payload the command ran with (after the middleware rewrote it) */
    readonly payload: unknown;
    /** the command's value */
    readonly result: unknown;
    readonly before: FlowDocument<T>;
    readonly after: FlowDocument<T>;
    readonly transient: boolean;
    readonly meta: Readonly<Record<string, unknown>> | undefined;
    /** for a batch: the commands it ran, flattened */
    readonly commands?: readonly BatchStep[];
}

/** Listens to every commit (`model.subscribe`). */
export type CommandListener<T extends FlowTypes = AnyTypes> = (
    event: CommandEvent<T>,
) => void;

/** A command as `model.get("commands")` describes it: ready to become an AI tool definition. */
export interface CommandInfo {
    readonly name: CommandName;
    readonly description: string;
    readonly payloadSchema: JsonSchema;
    readonly resultSchema: JsonSchema;
    /** whether it may run as a step of a continuous gesture */
    readonly transient: boolean;
    /** the feature it comes with (`@fragiola/flow/<feature>`), none for the core's */
    readonly feature?: FeatureName;
}
