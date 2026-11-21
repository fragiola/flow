// Undo and redo for a flow's model, as app code: the package ships none, so what counts as a step
// is the app's to decide. Copy this file and change it freely.
//
// It is built on three verbs only. `model.subscribe` tells every committed command with the
// document `before` and `after` it, and whether it was a step of a gesture (`transient`: a drag
// moves a node with transient commands and ends with a final one). `model.get("commands-to", …)`
// gives the commands that bring the document back to a saved one, and `model.run("batch", …)` runs
// them as one step, marked `meta: { undo: true }` so the history does not record it. Documents are
// immutable, so keeping one costs nothing. The kit never imports the package: the model is
// described by the few members this file reads, and the real one fits.

/** The part of a document the history keeps: its nodes and edges, as the model holds them. */
export interface DocumentLike {
    readonly nodes: readonly object[];
    readonly edges: readonly object[];
}

/** What `model.subscribe` tells. */
export interface CommandEventLike {
    readonly command: string;
    readonly before: DocumentLike;
    readonly after: DocumentLike;
    readonly transient: boolean;
    readonly meta: Readonly<Record<string, unknown>> | undefined;
}

/** The members of a flow model the history uses (`useFlow().model` fits). */
export interface HistoryModel {
    subscribe(listener: (event: CommandEventLike) => void): () => void;
    get(
        key: "commands-to",
        payload: { nodes: readonly never[]; edges: readonly never[] },
    ): readonly unknown[];
    run(
        command: "batch",
        payload: { commands: never[] },
        options: { meta: Readonly<Record<string, unknown>> },
    ): { readonly ok: boolean };
}

/** The history's state for a render: the same object until it changes. */
export interface UndoSnapshot {
    readonly canUndo: boolean;
    readonly canRedo: boolean;
    /** the commands undo goes back through, oldest first: the last one is undone next */
    readonly undoSteps: readonly string[];
    /** the commands redo goes forward through, the next one last */
    readonly redoSteps: readonly string[];
}

/** Options for {@link createUndoHistory}. */
export interface UndoOptions {
    /** the steps kept, oldest dropped first (default 100) */
    readonly limit?: number;
    /** commands that make no step (default: the selection's; a selection is not an edit) */
    readonly ignore?: readonly string[];
}

/** A history over one model: undo, redo, and a snapshot to render. */
export interface UndoHistory {
    /** puts the document back as it was before the last step; says whether it could */
    undo(): boolean;
    /** applies again the last step undone; says whether it could */
    redo(): boolean;
    /** the current snapshot (bound: `useSyncExternalStore(history.subscribe, history.getSnapshot)`) */
    getSnapshot(): UndoSnapshot;
    /** calls `listener` when the snapshot changes; returns the remover (bound) */
    subscribe(listener: () => void): () => void;
    /** stops listening to the model */
    dispose(): void;
}

/** The meta of what the history runs itself: it records none of it. */
export const UNDO_META = Object.freeze({ undo: true });

interface Entry {
    /** the command (or the batch) the step was */
    readonly command: string;
    /** the document on the other side of the step */
    readonly document: DocumentLike;
}

const SELECTION = ["selection.set", "selection.clear"];

/** A history of the model's steps, starting now. */
export function createUndoHistory(
    model: HistoryModel,
    options: UndoOptions = {},
): UndoHistory {
    const limit = options.limit ?? 100;
    const ignore = options.ignore ?? SELECTION;
    const undos: Entry[] = [];
    const redos: Entry[] = [];
    const listeners = new Set<() => void>();
    // the document before the step under way: a gesture's transient commands all belong to the
    // step its final command records
    let last: DocumentLike | undefined;
    let inGesture = false;
    // the document now: the last one the model committed
    let present: DocumentLike | undefined;
    let snapshot = createSnapshot();

    function createSnapshot(): UndoSnapshot {
        return {
            canUndo: undos.length > 0,
            canRedo: redos.length > 0,
            undoSteps: undos.map((entry) => entry.command),
            redoSteps: redos.map((entry) => entry.command),
        };
    }

    function notify() {
        snapshot = createSnapshot();
        for (const listener of [...listeners]) listener();
    }

    const stop = model.subscribe((event) => {
        present = event.after;
        if (event.meta?.undo === true) return;
        if (event.before === event.after) return;
        last ??= event.before;
        if (ignore.includes(event.command)) {
            // part of the document the next step goes back to, unless a gesture is under way
            if (!inGesture) last = event.after;
            return;
        }
        if (event.transient) {
            inGesture = true;
            return;
        }
        undos.push({ command: event.command, document: last });
        if (undos.length > limit) undos.shift();
        redos.length = 0;
        inGesture = false;
        last = event.after;
        notify();
    });

    /** Brings the model to `target`'s nodes and edges as one step; says whether it could. */
    function restore(target: DocumentLike): boolean {
        const commands = model.get("commands-to", {
            nodes: target.nodes as never[],
            edges: target.edges as never[],
        });
        if (commands.length === 0) return true;
        return model.run(
            "batch",
            { commands: commands as never[] },
            { meta: UNDO_META },
        ).ok;
    }

    function swap(from: Entry[], to: Entry[], current: () => DocumentLike) {
        const entry = from.pop();
        if (!entry) return false;
        const now = current();
        if (!restore(entry.document)) {
            from.push(entry); // refused (a middleware vetoed it): the step stays
            return false;
        }
        to.push({ command: entry.command, document: now });
        last = current();
        inGesture = false;
        notify();
        return true;
    }

    const current = () => present ?? last ?? { nodes: [], edges: [] };

    return {
        undo: () => swap(undos, redos, current),
        redo: () => swap(redos, undos, current),
        getSnapshot: () => snapshot,
        subscribe(listener) {
            listeners.add(listener);
            return () => listeners.delete(listener);
        },
        dispose() {
            stop();
            listeners.clear();
        },
    };
}

/** What {@link handleUndoKeys} reads of a key event: a DOM `KeyboardEvent`, or React's. */
type UndoKeyEvent = Pick<
    KeyboardEvent,
    "key" | "ctrlKey" | "metaKey" | "shiftKey" | "target" | "preventDefault"
>;

/**
 * The undo shortcuts, for a `keydown` listener: Ctrl/Cmd+Z undoes, Shift+Ctrl/Cmd+Z and
 * Ctrl/Cmd+Y redo. A text field keeps its own undo.
 */
export function handleUndoKeys(history: UndoHistory, event: UndoKeyEvent) {
    const target = event.target;
    const inTextField =
        target !== null &&
        "closest" in target &&
        (target as Element).closest("input, textarea, [contenteditable]") !==
            null;
    if (!(event.ctrlKey || event.metaKey) || inTextField) return;
    const key = event.key.toLowerCase();
    if (key === "z" && !event.shiftKey) history.undo();
    else if (key === "y" || key === "z") history.redo();
    else return;
    event.preventDefault();
}
