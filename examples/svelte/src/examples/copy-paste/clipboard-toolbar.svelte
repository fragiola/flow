<!-- The toolbar and the shortcuts: copy, cut and paste, and what the last one did. -->
<script module lang="ts">
    /** "2 nodes and 1 edge". */
    const counted = (payload: {
        nodes: readonly unknown[];
        edges: readonly unknown[];
    }) =>
        `${payload.nodes.length} ${payload.nodes.length === 1 ? "node" : "nodes"} and ${payload.edges.length} ${payload.edges.length === 1 ? "edge" : "edges"}`;

    /** Writes the system clipboard when the browser allows it; a refusal leaves the memory's copy. */
    async function writeSystem(text: string) {
        try {
            await navigator.clipboard?.writeText(text);
        } catch {
            // refused (no permission, the page not focused): the in-memory copy stands
        }
    }

    /** The system clipboard's text, or nothing when the browser refuses to read it. */
    async function readSystem(): Promise<string | undefined> {
        try {
            return await navigator.clipboard?.readText();
        } catch {
            return undefined;
        }
    }

    /** Whether the keys belong to a text field or a text selection rather than to the flow. */
    function typing(document: Document) {
        const active = document.activeElement;
        if (
            active instanceof HTMLElement &&
            (active.isContentEditable ||
                active.tagName === "INPUT" ||
                active.tagName === "TEXTAREA")
        )
            return true;
        const text = document.getSelection();
        return text !== null && !text.isCollapsed;
    }
</script>

<script lang="ts">
    import {
        type BatchEntry,
        useFlow,
        useKeyPress,
        useSelection,
        validateFlow,
    } from "@fragiola/flow-svelte";
    import { ClipboardPasteIcon, CopyIcon, ScissorsIcon } from "@lucide/svelte";
    import { untrack } from "svelte";
    import {
        afterCopy,
        afterCut,
        type Cascade,
        cascade,
        copyOf,
        type Payload,
        parse,
        pasted,
        serialize,
        shiftFor,
    } from "./clipboard";
    import { features, type PointerRef, type Types } from "./index.svelte";
    import { styles } from "./styles";

    const { pointer }: { pointer: PointerRef } = $props();

    const flow = useFlow<Types, typeof features>();
    const selection = useSelection<Types>();
    const selected = $derived(selection.current.nodes.length);
    let message = $state("Select nodes, then copy them.");
    // the example's own state, never rendered: the in-memory copy, where the next paste goes, the
    // pastes waiting for the one before them, and whether the toolbar is still mounted (a paste
    // waiting on the system clipboard does nothing once it is gone)
    let memory: Payload<Types> | undefined;
    let place: Cascade = afterCopy;
    let queue: Promise<void> = Promise.resolve();
    let mounted = true;
    $effect(() => () => {
        mounted = false;
    });

    function copy(cut: boolean) {
        const ids = flow.model.get("selected-nodes").map((node) => node.id);
        if (ids.length === 0) {
            message = "Select nodes to copy.";
            return;
        }
        const { nodes, edges } = flow.model.get("flow-json");
        const payload = copyOf(nodes, edges, ids);
        memory = payload;
        place = cut ? afterCut : afterCopy;
        void writeSystem(serialize(payload));
        if (cut) flow.model.run("selection.remove", {});
        message = `${cut ? "Cut" : "Copied"} ${counted(payload)}.`;
    }

    /** Pastes once the paste before it is done, so two quick presses never share ids. */
    function paste(atPointer: boolean) {
        queue = queue.then(() => pasteNow(atPointer));
    }

    async function pasteNow(atPointer: boolean) {
        // the system clipboard first (another tab's copy), this page's own copy otherwise
        const text = await readSystem();
        if (!mounted) return;
        const payload = parse<Types>(text) ?? memory;
        if (!payload) {
            message = "Nothing to paste yet.";
            return;
        }
        const { model, engine } = flow;
        const client = atPointer ? pointer.current : undefined;
        const at = client ? engine.get("screen-to-flow", client) : undefined;
        const { step, next } = cascade(place, at);
        const json = model.get("flow-json");
        const taken = [...json.nodes, ...json.edges].map((entity) => entity.id);
        const copies = pasted(payload, taken, shiftFor(payload, step, at));
        // text from outside the page: checked as a whole document before it is loaded
        const issues = validateFlow(
            { version: 1, nodes: copies.nodes, edges: copies.edges },
            { features },
        );
        if (issues.length > 0) {
            message = "The clipboard holds an unreadable flow.";
            return;
        }
        const commands: BatchEntry<Types>[] = [
            ...copies.nodes.map(
                (payload): BatchEntry<Types> => ({
                    command: "node.add",
                    payload,
                }),
            ),
            ...copies.edges.map(
                (payload): BatchEntry<Types> => ({
                    command: "edge.add",
                    payload,
                }),
            ),
            {
                command: "selection.set",
                payload: {
                    nodeIds: copies.nodes.map((node) => node.id),
                    mode: "replace",
                },
            },
        ];
        if (!model.run("batch", { commands }).ok) {
            message = "The paste was refused.";
            return;
        }
        place = next;
        message = `Pasted ${counted(copies)}.`;
    }

    function onKeys(action: "copy" | "cut" | "paste") {
        if (typing(globalThis.document)) return;
        if (action === "paste") paste(true);
        else copy(action === "cut");
    }

    // the shortcuts: Ctrl on Windows and Linux, ⌘ on macOS; each acts once per press (an effect
    // per key, tracking the press alone: what the action reads is untracked)
    const copyKeys = useKeyPress(["Control+c", "Meta+c"]);
    const cutKeys = useKeyPress(["Control+x", "Meta+x"]);
    const pasteKeys = useKeyPress(["Control+v", "Meta+v"]);
    $effect(() => {
        if (copyKeys.current) untrack(() => onKeys("copy"));
    });
    $effect(() => {
        if (cutKeys.current) untrack(() => onKeys("cut"));
    });
    $effect(() => {
        if (pasteKeys.current) untrack(() => onKeys("paste"));
    });
</script>

<div role="toolbar" aria-label="Clipboard" data-flow-no-gesture="" class={styles.panel}>
    <button
        type="button"
        disabled={selected === 0}
        onclick={() => copy(false)}
        class={styles.button}
    >
        <CopyIcon />
        Copy
    </button>
    <button
        type="button"
        disabled={selected === 0}
        onclick={() => copy(true)}
        class={styles.button}
    >
        <ScissorsIcon />
        Cut
    </button>
    <button type="button" onclick={() => paste(false)} class={styles.button}>
        <ClipboardPasteIcon />
        Paste
    </button>
    <p role="status" data-testid="message" class={styles.message}>
        {message}
    </p>
</div>
