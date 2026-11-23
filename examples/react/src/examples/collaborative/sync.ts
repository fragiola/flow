import type { Changes, Entity, Message, Peer, Point } from "./transport";

// One shared document between models, without a framework: each local command is sent as what it
// changed (`changesOf`: the nodes and edges it put or removed, the selection left out, because a
// selection is each side's own), and a peer applies what it receives as one `batch` of the
// commands `commands-to` gives (`merged`), so the last command to arrive wins for what it touched.
// A batch applied from a peer carries `REMOTE_META`, and what carries it is never sent again: no
// echo. A drag's transient moves are sent as they come, so the other side follows the drag. What
// each side selects and where its pointer is travel as presence (`presenceAfter`), never as
// commands.

/** A document as this file reads it: its nodes and edges. */
interface DocumentLike {
    readonly nodes: readonly object[];
    readonly edges: readonly object[];
}

/** The members of a flow model the sync uses (`createFlowModel`'s fits, whatever its types). */
export interface SyncModel {
    subscribe(
        listener: (event: {
            readonly before: DocumentLike;
            readonly after: DocumentLike;
            readonly transient: boolean;
            readonly meta: Readonly<Record<string, unknown>> | undefined;
        }) => void,
    ): () => void;
    get(key: "flow-json"): DocumentLike;
    get(
        key: "commands-to",
        payload: { nodes: readonly never[]; edges: readonly never[] },
    ): readonly { readonly command: string }[];
    run(
        command: "batch",
        payload: { commands: never[] },
        options: {
            transient: boolean;
            meta: Readonly<Record<string, unknown>>;
        },
    ): { readonly ok: boolean };
}

/** A document's nodes and edges, as entities. */
const entities = (document: DocumentLike) =>
    document as unknown as {
        readonly nodes: readonly Entity[];
        readonly edges: readonly Entity[];
    };

/** The meta of what a peer applies from another: its listener sends none of it back. */
export const REMOTE_META = Object.freeze({ remote: true });

/** Commands that may run as one step of a gesture: a batch of only these keeps `transient`. */
const TRANSIENT = new Set(["node.move", "node.resize"]);

/** A node or an edge without `selected`: what the other side receives of it. */
function shared(entity: Entity): Entity {
    const { selected: _, ...rest } = entity;
    return rest as Entity;
}

/** Whether two entities differ in anything but `selected`. */
function differs(a: Entity, b: Entity) {
    return a !== b && JSON.stringify(shared(a)) !== JSON.stringify(shared(b));
}

function diff(before: readonly Entity[], after: readonly Entity[]) {
    const old = new Map(before.map((entity) => [entity.id, entity]));
    const ids = new Set(after.map((entity) => entity.id));
    return {
        put: after
            .filter((entity) => {
                const was = old.get(entity.id);
                return was === undefined || differs(was, entity);
            })
            .map(shared),
        remove: before
            .filter((entity) => !ids.has(entity.id))
            .map((entity) => entity.id),
    };
}

/** What changed from `before` to `after`, or nothing when only the selection did. */
export function changesOf(
    before: {
        readonly nodes: readonly Entity[];
        readonly edges: readonly Entity[];
    },
    after: {
        readonly nodes: readonly Entity[];
        readonly edges: readonly Entity[];
    },
): Changes | undefined {
    const nodes = diff(before.nodes, after.nodes);
    const edges = diff(before.edges, after.edges);
    const empty =
        nodes.put.length +
            nodes.remove.length +
            edges.put.length +
            edges.remove.length ===
        0;
    return empty ? undefined : { nodes, edges };
}

/** `current` with `incoming` put over it: each keeps its place and its own `selected`. */
function put(
    current: readonly Entity[],
    incoming: readonly Entity[],
    remove: readonly string[],
): Entity[] {
    const gone = new Set(remove);
    const byId = new Map(incoming.map((entity) => [entity.id, entity]));
    const kept = current
        .filter((entity) => !gone.has(entity.id))
        .map((entity) => {
            const next = byId.get(entity.id);
            if (!next) return entity;
            byId.delete(entity.id);
            return entity.selected === true
                ? { ...next, selected: true }
                : next;
        });
    return [...kept, ...byId.values()];
}

/**
 * The document `current` becomes with `changes` applied: the entities put replace or join the
 * current ones, the ones removed go, and an edge left without one of its nodes goes too. With
 * `replace`, `changes.nodes.put` and `changes.edges.put` are the whole document (a snapshot).
 * Each side's selection stays its own.
 */
export function merged(
    current: {
        readonly nodes: readonly Entity[];
        readonly edges: readonly Entity[];
    },
    changes: Changes,
    replace = false,
) {
    const removeAll = (list: readonly Entity[], keep: readonly Entity[]) => {
        const ids = new Set(keep.map((entity) => entity.id));
        return list
            .filter((entity) => !ids.has(entity.id))
            .map((entity) => entity.id);
    };
    const nodes = put(
        current.nodes,
        changes.nodes.put,
        replace
            ? removeAll(current.nodes, changes.nodes.put)
            : changes.nodes.remove,
    );
    const nodeIds = new Set(nodes.map((node) => node.id));
    const edges = put(
        current.edges,
        changes.edges.put,
        replace
            ? removeAll(current.edges, changes.edges.put)
            : changes.edges.remove,
    ).filter(
        (edge) =>
            nodeIds.has(edge.source as string) &&
            nodeIds.has(edge.target as string),
    );
    return { nodes, edges };
}

/** Applies `changes` to `model` as one batch from a peer; says whether it could. */
export function apply(
    model: SyncModel,
    changes: Changes,
    options: { transient?: boolean; replace?: boolean } = {},
): boolean {
    const target = merged(
        entities(model.get("flow-json")),
        changes,
        options.replace,
    );
    const commands = model.get(
        "commands-to",
        target as { nodes: never[]; edges: never[] },
    );
    if (commands.length === 0) return true;
    const transient =
        options.transient === true &&
        commands.every((entry) => TRANSIENT.has(entry.command));
    return model.run(
        "batch",
        { commands: [...commands] as never[] },
        { transient, meta: REMOTE_META },
    ).ok;
}

/** The ids of the selected nodes of a document. */
export function selectedIds(nodes: readonly Entity[]): string[] {
    return nodes
        .filter((node) => node.selected === true)
        .map((node) => node.id);
}

/**
 * Keeps `model` and the document of `peer`'s hub as one: what a local command changes is sent,
 * what a peer sends is applied (marked `REMOTE_META`, never sent back), a hello is answered with
 * the whole document, and each change of the local selection is told. Returns the remover.
 */
export function syncModel(model: SyncModel, peer: Peer): () => void {
    let selection = JSON.stringify(
        selectedIds(entities(model.get("flow-json")).nodes),
    );
    return model.subscribe((event) => {
        const before = entities(event.before);
        const after = entities(event.after);
        if (event.meta?.remote !== true) {
            const changes = changesOf(before, after);
            if (changes)
                peer.send({
                    type: "changes",
                    changes,
                    transient: event.transient,
                });
        }
        // the selection is presence: told whoever changed it (a removed node leaves it)
        const now = JSON.stringify(selectedIds(after.nodes));
        if (now !== selection) {
            selection = now;
            peer.send({ type: "selection", nodeIds: selectedIds(after.nodes) });
        }
    });
}

/** Applies a document message from a peer to `model`, and answers a hello through `peer`. */
export function receive(model: SyncModel, peer: Peer, message: Message): void {
    if (message.type === "changes") {
        apply(model, message.changes, { transient: message.transient });
    } else if (message.type === "snapshot") {
        apply(
            model,
            {
                nodes: { put: message.nodes, remove: [] },
                edges: { put: message.edges, remove: [] },
            },
            { replace: true },
        );
    } else if (message.type === "hello") {
        const { nodes, edges } = entities(model.get("flow-json"));
        peer.send({
            type: "snapshot",
            nodes: nodes.map(shared),
            edges: edges.map(shared),
        });
    }
}

/** What a side shows of the others: each peer's name, cursor and selected nodes, by peer id. */
export type Presence = ReadonlyMap<
    string,
    {
        readonly name: string;
        readonly at: Point | null;
        readonly nodeIds: readonly string[];
    }
>;

/** The presence after `message` (the same object when it changes nothing shown). */
export function presenceAfter(presence: Presence, message: Message): Presence {
    if (message.type === "leave") {
        if (!presence.has(message.from)) return presence;
        const next = new Map(presence);
        next.delete(message.from);
        return next;
    }
    if (message.type !== "cursor" && message.type !== "selection")
        return presence;
    const was = presence.get(message.from) ?? {
        name: message.name,
        at: null,
        nodeIds: [],
    };
    const next = new Map(presence);
    next.set(
        message.from,
        message.type === "cursor"
            ? { ...was, name: message.name, at: message.at }
            : { ...was, name: message.name, nodeIds: message.nodeIds },
    );
    return next;
}

/** For each node some peer has selected, the names of those peers. */
export function remoteSelection(
    presence: Presence,
): ReadonlyMap<string, readonly string[]> {
    const names = new Map<string, string[]>();
    for (const { name, nodeIds } of presence.values()) {
        for (const id of nodeIds) {
            const list = names.get(id) ?? [];
            if (!list.includes(name)) list.push(name);
            names.set(id, list);
        }
    }
    return names;
}
