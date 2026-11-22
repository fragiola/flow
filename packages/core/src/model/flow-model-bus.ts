// The model's bus (Dockable's, fragiola/dockable, packages/core/src/state/model.ts, same author and
// licence; adapted to a flow document and to the feature registry). A command is looked up (the
// core's, then the installed features'), its payload validated against its schema, then it runs
// through the middleware chain (outermost first) on a draft; a success commits once and emits one
// event. A command issued from a middleware while another runs is queued and runs after it
// (`queued`); one a listener runs commits at once, its event delivered after the current one. Nothing here throws on bad input; a reducer or a listener that throws is a
// bug, rethrown once the chain unwound.
import { CORE_COMMANDS } from "../commands/catalogue";
import {
    type CommandDefinition,
    fail,
    invalid,
    type ReduceContext,
} from "../commands/define";
import type {
    BatchStep,
    CommandContext,
    CommandContextGetKey,
    CommandEvent,
    CommandInfo,
    CommandListener,
    CommandName,
    CommandResult,
    Middleware,
    RunOptions,
} from "../commands/types";
import type { IdSource } from "../document/create-id";
import type { FlowDocument } from "../document/types";
import { type FeatureName, requiresFeature } from "../features/keys";
import type { ComposedFeatures } from "../features/registry";
import { isObject, validate } from "../schema/validator";
import { cloneJson } from "../state/clone-json";
import {
    CORE_GET,
    CORE_IS,
    type QueryContext,
    stringOf,
} from "../state/core-queries";
import { deepFreeze } from "../state/deep-freeze";
import { Draft, type IndexedDocument, readerOf } from "../state/draft";

/** What the app adds to a dispatched command: never read from the untrusted input. */
export interface DispatchOptions {
    /** free-form information for middleware and listeners (`{ source: "assistant" }`) */
    meta?: Readonly<Record<string, unknown>> | undefined;
}

/** Where a command's errors point: into its payload, and at its transient flag. */
interface ErrorPaths {
    readonly payload: string;
    readonly transient: string;
}

/** One top-level execution: the draft it runs on, and what it collects (the steps of a batch). */
interface Execution {
    readonly draft: Draft;
    readonly dryRun: boolean;
    readonly options: RunOptions;
    readonly steps: BatchStep[];
    /** an exception a reducer threw: rethrown once the chain unwound */
    thrown: { error: unknown } | undefined;
}

function prefixed(
    result: CommandResult<unknown>,
    prefix: string,
): CommandResult<unknown> {
    if (result.ok || prefix === "") {
        return result;
    }
    const { error } = result;
    return {
        ok: false,
        error: {
            ...error,
            ...(error.path !== undefined
                ? { path: `${prefix}${error.path}` }
                : {}),
            ...(error.issues
                ? {
                      issues: error.issues.map((issue) => ({
                          path: `${prefix}${issue.path}`,
                          message: issue.message,
                      })),
                  }
                : {}),
        },
    };
}

/** The model's commands' descriptions: the core's, then each installed feature's. */
function describe(
    definitions: ReadonlyMap<string, CommandDefinition>,
    owners: ReadonlyMap<string, FeatureName>,
): readonly CommandInfo[] {
    return Object.freeze(
        [...definitions.values()].map((definition) => {
            const feature = owners.get(definition.name);
            return Object.freeze({
                name: definition.name,
                description: definition.description,
                payloadSchema: definition.payloadSchema,
                resultSchema: definition.resultSchema,
                transient: definition.transient,
                ...(feature === undefined ? {} : { feature }),
            });
        }),
    );
}

/** The bus behind a model (`createFlowModel`); its verbs are bound. */
export class FlowModelBus {
    private committed: IndexedDocument;
    private readonly ids: IdSource;
    private readonly features: ComposedFeatures;
    private readonly freeze: boolean;
    /** the fields `edge.add` fills in where its payload leaves them out (`defaultEdgeOptions`) */
    private readonly defaultEdge: Readonly<Record<string, unknown>> | undefined;
    private readonly definitions: ReadonlyMap<string, CommandDefinition>;
    private readonly infos: readonly CommandInfo[];
    private readonly middleware: Middleware[] = [];
    private readonly listeners = new Set<CommandListener>();
    private inFlight = 0;
    /** dry runs under way (`can`, `check`): a command a middleware issues then is refused */
    private dryRuns = 0;
    private readonly queue: (() => void)[] = [];
    private readonly events: CommandEvent[] = [];
    private delivering = false;

    constructor(
        committed: IndexedDocument,
        ids: IdSource,
        features: ComposedFeatures,
        freeze: boolean,
        defaultEdge?: Readonly<Record<string, unknown>> | undefined,
    ) {
        this.defaultEdge = defaultEdge;
        this.committed = committed;
        this.ids = ids;
        this.features = features;
        this.freeze = freeze;
        const definitions = new Map<string, CommandDefinition>();
        const owners = new Map<string, FeatureName>();
        for (const definition of CORE_COMMANDS) {
            definitions.set(definition.name, definition);
        }
        for (const feature of features.list) {
            for (const definition of feature.commands ?? []) {
                definitions.set(definition.name, definition);
                owners.set(definition.name, feature.name);
            }
        }
        this.definitions = definitions;
        this.infos = describe(definitions, owners);
        // the bus can be passed around detached: `const { run } = model`
        this.run = this.run.bind(this);
        this.dispatch = this.dispatch.bind(this);
        this.can = this.can.bind(this);
        this.check = this.check.bind(this);
        this.get = this.get.bind(this);
        this.is = this.is.bind(this);
        this.use = this.use.bind(this);
        this.subscribe = this.subscribe.bind(this);
    }

    // ---------------------------------------------------------------------------------------------
    // reads
    // ---------------------------------------------------------------------------------------------

    private queryContext(): QueryContext {
        return {
            reader: readerOf(this.committed),
            features: this.features,
            commands: this.infos,
            defaultEdge: this.defaultEdge,
        };
    }

    get(key: string, payload?: unknown): unknown {
        const core = Object.hasOwn(CORE_GET, key) ? CORE_GET[key] : undefined;
        if (core) {
            return core(this.queryContext(), payload);
        }
        return this.features.get.get(key)?.(readerOf(this.committed), payload);
    }

    is(key: string, payload?: unknown): boolean {
        const core = Object.hasOwn(CORE_IS, key) ? CORE_IS[key] : undefined;
        if (core) {
            return core(this.queryContext(), payload);
        }
        return (
            this.features.is.get(key)?.(readerOf(this.committed), payload) ??
            false
        );
    }

    // ---------------------------------------------------------------------------------------------
    // the bus
    // ---------------------------------------------------------------------------------------------

    use(middleware: Middleware): () => void {
        this.middleware.push(middleware);
        return () => {
            const at = this.middleware.indexOf(middleware);
            if (at >= 0) {
                this.middleware.splice(at, 1);
            }
        };
    }

    subscribe(listener: CommandListener): () => void {
        // a wrapper: the same function subscribed twice is two subscriptions
        const wrapper: CommandListener = (event) => listener(event);
        this.listeners.add(wrapper);
        return () => {
            this.listeners.delete(wrapper);
        };
    }

    run(
        command: string,
        payload?: unknown,
        options?: RunOptions,
    ): CommandResult<unknown> {
        return this.enqueueOrExecute(
            command,
            payload === undefined ? {} : payload,
            options,
            "",
        );
    }

    can(command: string, payload?: unknown, options?: RunOptions): boolean {
        return this.check(command, payload, options).ok;
    }

    check(
        command: string,
        payload?: unknown,
        options?: RunOptions,
    ): CommandResult<unknown> {
        return this.execute(
            command,
            payload === undefined ? {} : payload,
            options ?? {},
            true,
            "",
        );
    }

    dispatch(
        input: unknown,
        options: DispatchOptions = {},
    ): CommandResult<unknown> {
        if (!isObject(input)) {
            return fail(
                "invalid_payload",
                "must be an object { command, payload }",
                "",
            );
        }
        const { command, payload, transient } = input;
        if (typeof command !== "string") {
            return fail("invalid_payload", "must be a string", "/command");
        }
        const unknown = this.unknownCommand(command, "/command");
        if (unknown) {
            return unknown;
        }
        if (!isObject(payload)) {
            return fail("invalid_payload", "must be an object", "/payload");
        }
        if (transient !== undefined && typeof transient !== "boolean") {
            return fail("invalid_payload", "must be a boolean", "/transient");
        }
        for (const key of Object.keys(input)) {
            if (key !== "command" && key !== "payload" && key !== "transient") {
                return fail("invalid_payload", "is not allowed", `/${key}`);
            }
        }
        return this.enqueueOrExecute(
            command,
            payload,
            {
                ...(transient === undefined ? {} : { transient }),
                ...(options.meta === undefined ? {} : { meta: options.meta }),
            },
            "/payload",
        );
    }

    /** Why a name is not a command of this model: unknown, or its feature is not installed. */
    private unknownCommand(command: string, path?: string) {
        if (this.definitions.has(command)) {
            return undefined;
        }
        const owner = this.features.missing("commands", command);
        return owner === undefined
            ? fail("unknown_command", `unknown command "${command}"`, path)
            : fail("not_found", `"${command}" ${requiresFeature(owner)}`, path);
    }

    private enqueueOrExecute(
        command: string,
        payload: unknown,
        options: RunOptions | undefined,
        prefix: string,
    ): CommandResult<unknown> {
        if (this.dryRuns > 0) {
            // issued from a middleware during `can` / `check`: a dry run causes nothing
            return fail(
                "refused",
                `"${command}" was issued during a dry run (\`can\`, \`check\`); it does not run`,
            );
        }
        if (this.inFlight > 0) {
            // issued from a middleware: runs once the current command committed
            this.queue.push(() => {
                this.execute(command, payload, options ?? {}, false, prefix);
            });
            return fail(
                "queued",
                `"${command}" was issued while another command was running; it runs after it`,
            );
        }
        try {
            return this.execute(command, payload, options ?? {}, false, prefix);
        } finally {
            // a throwing listener or reducer must not strand the commands a middleware queued
            this.drain();
        }
    }

    private drain() {
        while (this.inFlight === 0 && this.queue.length > 0) {
            this.queue.shift()?.();
        }
    }

    private execute(
        command: string,
        payload: unknown,
        options: RunOptions,
        dryRun: boolean,
        prefix: string,
    ): CommandResult<unknown> {
        // a dry run commits nothing, not even the ids it generated (nor asks the app's createId)
        const ids = dryRun ? this.ids.dryClone() : this.ids;
        const draft = new Draft(this.committed, ids);
        const execution: Execution = {
            draft,
            dryRun,
            options,
            steps: [],
            thrown: undefined,
        };
        if (dryRun) {
            this.dryRuns++;
        } else {
            this.inFlight++;
        }
        let ran: { result: CommandResult<unknown>; payload: unknown };
        try {
            ran = this.runChain(
                execution,
                command,
                payload,
                { payload: prefix, transient: "/transient" },
                false,
            );
        } finally {
            if (dryRun) {
                this.dryRuns--;
            } else {
                this.inFlight--;
            }
        }
        if (execution.thrown) {
            throw execution.thrown.error;
        }
        const { result } = ran;
        if (!result.ok || dryRun) {
            return result;
        }
        const before = this.committed.document;
        this.committed = draft.commit(this.freeze);
        this.emit({
            command: command as CommandName,
            payload: ran.payload,
            result: result.value,
            before,
            after: this.committed.document,
            transient: options.transient === true,
            meta: options.meta,
            ...(command === "batch" ? { commands: execution.steps } : {}),
        });
        return result;
    }

    /**
     * Looks up, validates and runs one command through the middleware chain on the execution's
     * draft. Returns its result, its errors placed at `at`, and the payload the reducer ran with (a
     * middleware may have rewritten it).
     */
    private runChain(
        execution: Execution,
        command: string,
        payload: unknown,
        at: ErrorPaths,
        inBatch: boolean,
    ): { result: CommandResult<unknown>; payload: unknown } {
        const { draft, dryRun, options } = execution;
        const definition = this.definitions.get(command);
        // the default edge fields go under what an `edge.add` gives, before anything sees it
        if (
            command === "edge.add" &&
            this.defaultEdge !== undefined &&
            isObject(payload)
        ) {
            payload = {
                ...this.defaultEdge,
                ...Object.fromEntries(
                    Object.entries(payload).filter(
                        ([, value]) => value !== undefined,
                    ),
                ),
            };
        }
        if (!definition) {
            return {
                result:
                    this.unknownCommand(command) ??
                    fail("unknown_command", command),
                payload,
            };
        }
        const failed = invalid(
            validate(definition.payloadSchema, payload, at.payload),
        );
        if (failed) {
            return { result: failed, payload };
        }
        if (options.transient === true && !definition.transient) {
            return {
                result: fail(
                    "invalid_payload",
                    `"${command}" cannot run as a transient step`,
                    at.transient,
                ),
                payload,
            };
        }

        // the chain sees a frozen copy: a middleware rewrites by assigning a new payload (validated
        // again), never by writing into it, and nothing reaches back into the caller's object
        const validated = deepFreeze(cloneJson(payload));
        const context = {
            command: command as CommandName,
            payload: validated,
            dryRun,
            transient: options.transient === true,
            inBatch,
            meta: options.meta,
            state: this.committed.document as FlowDocument,
            get: (key: CommandContextGetKey, query?: unknown) => {
                const id = stringOf(query, "id");
                if (id === undefined) {
                    return undefined;
                }
                return key === "node-by" ? draft.node(id) : draft.edge(id);
            },
        } as CommandContext;

        const reduceContext: ReduceContext = {
            draft,
            features: this.features,
            runInBatch: (subCommand, subPayload, path) => {
                const sub = this.runChain(
                    execution,
                    subCommand,
                    subPayload,
                    {
                        payload: `${path}/payload`,
                        transient: `${path}/command`,
                    },
                    true,
                );
                const { result } = sub;
                if (!result.ok) {
                    const { error } = result;
                    if (
                        error.code === "unknown_command" ||
                        (error.code === "not_found" &&
                            !this.definitions.has(subCommand))
                    ) {
                        return fail(
                            error.code,
                            error.message,
                            `${path}/command`,
                        );
                    }
                    // an error with no place of its own (a veto) points at its step
                    return error.path === undefined
                        ? { ok: false, error: { ...error, path } }
                        : result;
                }
                // a nested batch's own steps are listed; the batch itself is not one
                if (subCommand !== "batch") {
                    execution.steps.push({
                        command: subCommand as CommandName,
                        payload: sub.payload,
                        result: result.value,
                    });
                }
                return result;
            },
        };

        let ranWith: unknown = validated;
        let reduced: CommandResult<unknown> | undefined;
        const core = (): CommandResult<unknown> => {
            if (context.payload !== validated) {
                const rewritten = invalid(
                    validate(definition.payloadSchema, context.payload),
                    "rewritten by a middleware: ",
                );
                if (rewritten) {
                    return rewritten;
                }
                ranWith = deepFreeze(cloneJson(context.payload));
            }
            try {
                reduced = definition.reduce(ranWith as never, reduceContext);
            } catch (thrown) {
                execution.thrown ??= { error: thrown };
                reduced = fail("refused", "the command failed");
            }
            return reduced;
        };
        const chained = this.chain(context, core);
        // a middleware may veto a success, never turn a failure into one: the draft the failed
        // command may have half written is not committed (a batch stays all or nothing)
        const result = prefixed(
            chained.ok && reduced !== undefined && !reduced.ok
                ? reduced
                : chained,
            at.payload,
        );
        return { result, payload: ranWith };
    }

    private chain(
        context: CommandContext,
        core: () => CommandResult<unknown>,
    ): CommandResult<unknown> {
        const list = [...this.middleware];
        const at = (i: number): CommandResult<unknown> => {
            const middleware = list[i];
            if (!middleware) {
                return core();
            }
            let called = false;
            let nextResult: CommandResult<unknown> = fail(
                "vetoed",
                "a middleware returned no result",
            );
            const next = () => {
                if (!called) {
                    called = true;
                    nextResult = at(i + 1);
                }
                return nextResult;
            };
            let out: CommandResult<unknown> | undefined;
            try {
                out = middleware(context, next);
            } catch (thrown) {
                return fail(
                    "middleware_error",
                    thrown instanceof Error ? thrown.message : String(thrown),
                );
            }
            return out ?? nextResult;
        };
        return at(0);
    }

    private emit(event: CommandEvent) {
        this.events.push(event);
        if (this.delivering) {
            return;
        }
        this.delivering = true;
        let failure: { error: unknown } | undefined;
        try {
            for (
                let next = this.events.shift();
                next !== undefined;
                next = this.events.shift()
            ) {
                for (const listener of [...this.listeners]) {
                    try {
                        listener(next);
                    } catch (thrown) {
                        failure ??= { error: thrown };
                    }
                }
            }
        } finally {
            this.delivering = false;
        }
        if (failure) {
            throw failure.error;
        }
    }
}
