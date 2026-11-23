// Which items a committed node or edge list replaced in place (Issue #59): a draft that only
// replaced items (a move, a resize, a flag) records, beside the new list, the list it copied and the
// ids it replaced. The engine's geometry then knows what a drag step changed without comparing the
// whole list. Internal (not exported): the document keeps its shape and its public events. Lists are
// the keys of a WeakMap, so a list nobody holds is forgotten with its record.

interface Replacement {
    readonly from: readonly unknown[];
    readonly ids: ReadonlySet<string>;
}

const replacements = new WeakMap<readonly unknown[], Replacement>();

/** The most commits a lookup walks back through before giving up (the caller compares instead). */
const MOST_STEPS = 32;

/** Records that `list` is `from` with the items of `ids` replaced, at the same places. */
export function recordReplaced(
    list: readonly unknown[],
    from: readonly unknown[],
    ids: ReadonlySet<string>,
): void {
    replacements.set(list, { from, ids });
}

/**
 * The ids of the items replaced between `since` and `list`, when every commit between them only
 * replaced items (so the ids and their places are the same); undefined when unknown.
 */
export function replacedSince(
    list: readonly unknown[],
    since: readonly unknown[],
): ReadonlySet<string> | undefined {
    let at = list;
    let ids: Set<string> | undefined;
    let only: ReadonlySet<string> | undefined;
    for (let step = 0; step < MOST_STEPS; step++) {
        const record = replacements.get(at);
        if (!record) return undefined;
        if (only === undefined && ids === undefined) only = record.ids;
        else {
            ids ??= new Set(only);
            for (const id of record.ids) ids.add(id);
        }
        if (record.from === since) return ids ?? only;
        at = record.from;
    }
    return undefined;
}
