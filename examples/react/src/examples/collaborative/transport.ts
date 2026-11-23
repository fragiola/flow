// How the collaborators reach each other, without a framework or a server: a hub in memory joins
// the peers of this page (Alice and Bob), and a `BroadcastChannel` joins the hubs of other tabs of
// the same page. Every message names the peer that sent it; the hub never hands a message back to
// its sender, and a tab never posts back to the channel what came from it, so nothing echoes. What
// a message means for the document is `sync.ts`'s business; this file only carries it.

/** A point in flow coordinates. */
export interface Point {
    readonly x: number;
    readonly y: number;
}

/** An entity of the document as it travels: a node or an edge, by its id. */
export interface Entity {
    readonly id: string;
    readonly [field: string]: unknown;
}

/** What one side's command changed: the entities it put (added or changed) and those it removed. */
export interface Changes {
    readonly nodes: {
        readonly put: readonly Entity[];
        readonly remove: readonly string[];
    };
    readonly edges: {
        readonly put: readonly Entity[];
        readonly remove: readonly string[];
    };
}

/** What a peer says, before the transport stamps it with the sender. */
export type Said =
    /** a local command changed the document; `transient`: a step of a gesture (a drag) */
    | {
          readonly type: "changes";
          readonly changes: Changes;
          readonly transient: boolean;
      }
    /** a newcomer (another tab) asks for the document */
    | { readonly type: "hello" }
    /** the whole document, for a newcomer */
    | {
          readonly type: "snapshot";
          readonly nodes: readonly Entity[];
          readonly edges: readonly Entity[];
      }
    /** where the pointer is over the sender's flow, or `null` once it left */
    | { readonly type: "cursor"; readonly at: Point | null }
    /** the nodes the sender has selected */
    | { readonly type: "selection"; readonly nodeIds: readonly string[] }
    /** the sender is gone: forget its cursor and selection */
    | { readonly type: "leave" };

/** A message on the wire: what was said, by whom (an id unique to the peer, and its name). */
export type Message = Said & { readonly from: string; readonly name: string };

/** The kinds of message, for a guard on what arrives from outside the page. */
export const MESSAGE_TYPES = [
    "changes",
    "hello",
    "snapshot",
    "cursor",
    "selection",
    "leave",
] as const satisfies readonly Message["type"][];

/** A peer's end of the hub: it sends to every other peer and stops listening when it leaves. */
export interface Peer {
    readonly id: string;
    readonly name: string;
    send(said: Said): void;
    /** passes on a message another peer sent (from another tab), to every peer but this one */
    forward(message: Message): void;
    leave(): void;
}

/** The meeting point of a page's peers. */
export interface Hub {
    /** joins as `id` (unique) named `name`; `listener` gets what the other peers send */
    join(id: string, name: string, listener: (message: Message) => void): Peer;
    /** the ids of the peers joined now */
    peers(): readonly string[];
}

/** A hub in memory: a message reaches every peer but its sender, at once and in order. */
export function createHub(): Hub {
    const listeners = new Map<string, (message: Message) => void>();
    // messages sent while one is being delivered wait for it: every peer sees the same order
    const queue: { message: Message; skip: string }[] = [];
    let delivering = false;

    function deliver(message: Message, skip: string) {
        queue.push({ message, skip });
        if (delivering) return;
        delivering = true;
        try {
            for (let next = queue.shift(); next; next = queue.shift()) {
                for (const [id, listener] of [...listeners]) {
                    if (id !== next.skip && id !== next.message.from)
                        listener(next.message);
                }
            }
        } finally {
            delivering = false;
            queue.length = 0;
        }
    }

    return {
        join(id, name, listener) {
            if (listeners.has(id))
                throw new Error(`"${id}" has joined already`);
            listeners.set(id, listener);
            const joined = () => listeners.get(id) === listener;
            return {
                id,
                name,
                send(said) {
                    if (joined()) deliver({ ...said, from: id, name }, id);
                },
                forward(message) {
                    if (joined()) deliver(message, id);
                },
                leave() {
                    if (!joined()) return;
                    deliver({ type: "leave", from: id, name }, id);
                    listeners.delete(id);
                },
            };
        },
        peers: () => [...listeners.keys()],
    };
}

/** Whether `value` looks like a {@link Message}: what another tab posts is checked first. */
export function isMessage(value: unknown): value is Message {
    if (typeof value !== "object" || value === null) return false;
    const message = value as Record<string, unknown>;
    return (
        typeof message.from === "string" &&
        typeof message.name === "string" &&
        (MESSAGE_TYPES as readonly unknown[]).includes(message.type)
    );
}

/** The part of `BroadcastChannel` the bridge uses (the browser's, and Node's, fit). */
export interface ChannelLike {
    postMessage(message: unknown): void;
    addEventListener(
        type: "message",
        listener: (event: { data: unknown }) => void,
    ): void;
    close(): void;
}

/** A link between a hub and other tabs; `close` ends it. */
export interface Bridge {
    /** whether other tabs can be reached (false where `BroadcastChannel` is missing) */
    readonly connected: boolean;
    close(): void;
}

/** Opens the browser's `BroadcastChannel`, or nothing where there is none (an old browser). */
function openBroadcast(name: string): ChannelLike | undefined {
    return typeof BroadcastChannel === "undefined"
        ? undefined
        : new BroadcastChannel(name);
}

/**
 * Joins `hub` to the hubs of other tabs over a `BroadcastChannel` named `name`: what a peer of
 * this page sends is posted to the channel, and what another tab posts is passed into this hub
 * under its own sender, never back out (a message of this page's own peers coming back is
 * dropped). On opening it says hello, for a peer of a tab already open to send the document. Where
 * `BroadcastChannel` does not exist, it does nothing.
 */
export function bridgeTabs(
    hub: Hub,
    name: string,
    open: (name: string) => ChannelLike | undefined = openBroadcast,
): Bridge {
    const channel = open(name);
    if (!channel) return { connected: false, close() {} };
    let closed = false;
    const id = `tab-${Math.random().toString(36).slice(2, 10)}`;
    const peer = hub.join(id, "tab", (message) => {
        if (!closed) channel.postMessage(message);
    });
    channel.addEventListener("message", (event) => {
        if (closed || !isMessage(event.data)) return;
        if (hub.peers().includes(event.data.from)) return; // an echo of this page
        peer.forward(event.data);
    });
    channel.postMessage({
        type: "hello",
        from: id,
        name: "tab",
    } satisfies Message);
    return {
        connected: true,
        close() {
            if (closed) return;
            peer.leave();
            closed = true;
            channel.close();
        },
    };
}
