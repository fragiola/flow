// What `set-interactive` switches (the Controls' lock): the whole flow (`interactive`) and, inside
// it, each kind of gesture and key on its own. The engine holds the switches as its state and every
// feature reads them through the host (`host.allows(kind)`) at the moment it would act, so a switch
// turned off stops its gestures at once without installing anything again. Pan and zoom are never
// switched off: they change the view, not the flow.

/** A kind of gesture and key `set-interactive` turns on or off on its own. */
export type InteractionKind = "drag" | "connect" | "select" | "reconnect";

/** The kinds, in a stable order. */
export const INTERACTION_KINDS: readonly InteractionKind[] = Object.freeze([
    "drag",
    "connect",
    "select",
    "reconnect",
]);

/**
 * The switches of `set-interactive`: `interactive` (every gesture and key that changes the flow)
 * and each kind (`drag`: dragging nodes and moving them with the arrows; `connect`: drawing edges;
 * `select`: taps, the selection box, Enter and Space; `reconnect`: moving an edge's ends).
 */
export interface Interactivity {
    readonly interactive: boolean;
    readonly drag: boolean;
    readonly connect: boolean;
    readonly select: boolean;
    readonly reconnect: boolean;
}

/** What `set-interactive` takes: the switches it changes (at least one), the others kept. */
export type InteractivityPayload = Partial<Interactivity>;
