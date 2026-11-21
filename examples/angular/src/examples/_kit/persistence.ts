// From Splitter (fragiola/splitter, examples/react/src/examples/_kit/persistence.ts), same author
// and licence.
// Saving a flow in the browser: app policy, never the package's. Copy this file and change it
// freely. Every access is guarded: storage may be blocked, full or private.
//
// What a flow saves is its JSON document, `model.get("flow-json")` (nodes and edges, plain JSON),
// and, if the app wants it, its viewport, `engine.get("viewport")` (view state, not the document).

/** The value saved under `key`, or `undefined` (nothing saved, unreadable, or not JSON). */
export function load<T>(key: string): T | undefined {
    try {
        const raw = localStorage.getItem(key);
        return raw === null ? undefined : (JSON.parse(raw) as T);
    } catch {
        return undefined;
    }
}

/** Saves `value` under `key` as JSON; says whether it could. */
export function save(key: string, value: unknown): boolean {
    try {
        localStorage.setItem(key, JSON.stringify(value));
        return true;
    } catch {
        return false;
    }
}

/** Forgets what is saved under `key`. */
export function forget(key: string): void {
    try {
        localStorage.removeItem(key);
    } catch {
        // nothing saved, nothing to forget
    }
}
