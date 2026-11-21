// The flow model (D3, D13): the document and its rules, the single source of truth. An immutable
// document that only commands change, usable in plain Node (no DOM). Its surface is exactly the
// five verbs plus `use`, `subscribe` and `dispatch` (a guard test keeps it so); its keys are the
// core's and the installed features' (`F`): a command or key of a feature that is not installed
// does not compile, and at runtime is `not_found` (a command) or `undefined` / `false` (a key).
import type {
    CommandContext,
    CommandListener,
    CommandResult,
    PayloadOf,
    ResultOf,
    RunOptions,
} from "../commands/types";
import { type CreateId, IdSource } from "../document/create-id";
import { FlowValidationError } from "../document/flow-validation-error";
import { loadDocument } from "../document/load-document";
import type { AnyTypes, FlowJson, FlowTypes } from "../document/types";
import { composeFeatures, registerFeatures } from "../features/registry";
import type {
    CommandNameOf,
    FlowFeatures,
    ModelGetKeyOf,
    ModelIsKeyOf,
} from "../features/types";
import type {
    ModelGetPayload,
    ModelGetResult,
    ModelIsPayload,
    NoPayload,
    QueryArgs,
} from "../state/queries";
import { type DispatchOptions, FlowModelBus } from "./flow-model-bus";

export type { DispatchOptions } from "./flow-model-bus";

/**
 * The arguments after a command's name: its payload (optional when it has no required field:
 * `model.run("selection.clear")`) and the run options.
 */
export type CommandArgs<P> = NoPayload extends P
    ? [payload?: P, options?: RunOptions]
    : [payload: P, options?: RunOptions];

/**
 * The flow model. Every member is one verb, and bound (`const { run } = model` works):
 *
 * - `run` changes the flow (a command, through the middleware chain); `dispatch` is `run` for
 *   untrusted JSON;
 * - `can` answers whether `run` would succeed; `check` returns what it would return;
 * - `get` reads (`model.get("node-by", { id })`); `is` asks a yes/no question
 *   (`model.is("node-draggable", { nodeId })`);
 * - `use` adds a middleware around every command; `subscribe` listens to every commit.
 *
 * `F` is the installed features; the default, any features, is what every model is assignable to.
 */
export interface FlowModel<
    T extends FlowTypes = AnyTypes,
    F extends FlowFeatures = FlowFeatures,
> {
    /**
     * changes the flow: runs a command (typed) through the middleware chain; never throws on bad
     * input. A command of a feature that is not installed returns `not_found`
     */
    run<C extends CommandNameOf<F>>(
        command: C,
        ...args: CommandArgs<PayloadOf<T, C>>
    ): CommandResult<ResultOf<T, C>>;
    /**
     * `run` for a command given as untrusted JSON `{ command, payload, transient? }`, validated
     * first; `options.meta` (the app's, never the input's) reaches middleware and listeners
     */
    dispatch(input: unknown, options?: DispatchOptions): CommandResult<unknown>;
    /** whether `run` would succeed now (a dry run: nothing is committed or emitted) */
    can<C extends CommandNameOf<F>>(
        command: C,
        ...args: CommandArgs<PayloadOf<T, C>>
    ): boolean;
    /** what `run` would return (its value, or why it is refused), without committing or emitting */
    check<C extends CommandNameOf<F>>(
        command: C,
        ...args: CommandArgs<PayloadOf<T, C>>
    ): CommandResult<ResultOf<T, C>>;
    /** reads from the committed document: a node, the edges of a node, the JSON, the commands, … */
    get<K extends ModelGetKeyOf<F>>(
        key: K,
        ...payload: QueryArgs<ModelGetPayload<T, K>>
    ): ModelGetResult<T, K>;
    /** asks a yes/no question about the committed document */
    is<K extends ModelIsKeyOf<F>>(key: K, payload: ModelIsPayload<K>): boolean;
    /** adds a middleware around every command (the first added runs outermost); returns its remover */
    use(
        middleware: {
            // a method's parameters compare both ways: a model with features is a model
            middleware(
                ctx: CommandContext<T, F>,
                next: () => CommandResult<unknown>,
            ): CommandResult<unknown> | undefined;
        }["middleware"],
    ): () => void;
    /** listens to every committed command (one event per commit); returns its remover */
    subscribe(listener: CommandListener<T>): () => void;
}

/** Options of {@link createFlowModel}. */
export interface FlowModelOptions<F extends FlowFeatures = readonly []> {
    /**
     * the opt-in features (`[selection(), subflows()]`), each from its own entry
     * (`@fragiola/flow/<feature>`): fixed for the model's life. Without them, a bare flow
     */
    features?: F | undefined;
    /** generates the id of a node or edge given without one; default `` `${kind}-${n}` `` */
    createId?: CreateId | undefined;
    /** freeze the document (default true) */
    freeze?: boolean | undefined;
}

const EMPTY_FLOW: FlowJson = { version: 1, nodes: [], edges: [] };

/**
 * Creates a flow model from a JSON v1 document (an empty flow without one), with the features it
 * installs (`createFlowModel<Types, typeof features>(json, { features })`). The document is
 * validated: an invalid one throws a {@link FlowValidationError} listing every problem with its
 * JSON path. A feature installed twice, or missing one it requires, throws a `TypeError` naming
 * both.
 */
export function createFlowModel<
    T extends FlowTypes = AnyTypes,
    const F extends FlowFeatures = readonly [],
>(json?: FlowJson<T>, options: FlowModelOptions<F> = {}): FlowModel<T, F> {
    const features = composeFeatures(options.features);
    const ids = new IdSource(options.createId);
    const freeze = options.freeze ?? true;
    const loaded = loadDocument(json ?? EMPTY_FLOW, ids, features, freeze);
    if (!loaded.ok) {
        throw new FlowValidationError(loaded.issues);
    }
    const bus = new FlowModelBus(loaded.indexed, ids, features, freeze);
    // the verbs only, bound: the surface stays exact (the bus's internals are not reachable)
    const model = Object.freeze({
        run: bus.run,
        dispatch: bus.dispatch,
        can: bus.can,
        check: bus.check,
        get: bus.get,
        is: bus.is,
        use: bus.use,
        subscribe: bus.subscribe,
    }) as unknown as FlowModel<T, F>;
    registerFeatures(model, features);
    return model;
}
