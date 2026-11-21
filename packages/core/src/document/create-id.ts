// From Dockable (fragiola/dockable, packages/core/src/state/ids.ts), same author and licence.
// Adapted: the kinds are a flow's (a node, an edge).

/** What an id is generated for. */
export type IdKind = "node" | "edge";

/**
 * Generates the id of a node or an edge given without one (the `createId` option). The model skips
 * an id already in use and asks again; no global `crypto` is ever used.
 */
export type CreateId = (kind: IdKind) => string;

/** How many times a custom generator is asked before the default takes over. */
const ATTEMPTS = 100;

/**
 * The ids of one model. The default generator is deterministic: `` `${kind}-${n}` `` with one
 * counter per kind.
 */
export class IdSource {
    private readonly counters = new Map<IdKind, number>();
    private readonly custom: CreateId | undefined;

    constructor(createId?: CreateId) {
        this.custom = createId;
    }

    /**
     * A copy with the same counters and no custom generator: a dry run draws ids from it, leaving
     * this one as it was and never asking the app's `createId` (so `check`'s id is only indicative).
     */
    dryClone(): IdSource {
        const copy = new IdSource();
        for (const [kind, n] of this.counters) {
            copy.counters.set(kind, n);
        }
        return copy;
    }

    /** A fresh id for `kind`, for which `isUsed` is false. */
    next(kind: IdKind, isUsed: (id: string) => boolean): string {
        if (this.custom) {
            for (let i = 0; i < ATTEMPTS; i++) {
                const id = this.custom(kind);
                if (typeof id === "string" && id !== "" && !isUsed(id)) {
                    return id;
                }
            }
        }
        for (;;) {
            const n = (this.counters.get(kind) ?? 0) + 1;
            this.counters.set(kind, n);
            const id = `${kind}-${n}`;
            if (!isUsed(id)) {
                return id;
            }
        }
    }
}
