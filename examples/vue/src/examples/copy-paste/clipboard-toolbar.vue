<script setup lang="ts">
import {
    type BatchEntry,
    useFlow,
    useKeyPress,
    useSelection,
    validateFlow,
} from "@fragiola/flow-vue";
import { ClipboardPasteIcon, CopyIcon, ScissorsIcon } from "@lucide/vue";
import { computed, shallowRef, watch } from "vue";
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
import { features, type PointerRef, type Types } from "./index.vue";
import { styles } from "./styles";

// The toolbar and the shortcuts: copy, cut and paste, and what the last one did.

const props = defineProps<{ pointer: PointerRef }>();

const { model, engine } = useFlow<Types, typeof features>();
const selection = useSelection<Types>();
const selected = computed(() => selection.value.nodes.length);
const message = shallowRef("Select nodes, then copy them.");
// the example's own state, never rendered: the in-memory copy, where the next paste goes and the
// pastes waiting for the one before them
let memory: Payload<Types> | undefined;
let place: Cascade = afterCopy;
let queue: Promise<void> = Promise.resolve();

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

function copy(cut: boolean) {
    const ids = model.get("selected-nodes").map((node) => node.id);
    if (ids.length === 0) {
        message.value = "Select nodes to copy.";
        return;
    }
    const { nodes, edges } = model.get("flow-json");
    const payload = copyOf(nodes, edges, ids);
    memory = payload;
    place = cut ? afterCut : afterCopy;
    void writeSystem(serialize(payload));
    if (cut) model.run("selection.remove", {});
    message.value = `${cut ? "Cut" : "Copied"} ${counted(payload)}.`;
}

/** Pastes once the paste before it is done, so two quick presses never share ids. */
function paste(atPointer: boolean) {
    queue = queue.then(() => pasteNow(atPointer));
}

async function pasteNow(atPointer: boolean) {
    // the system clipboard first (another tab's copy), this page's own copy otherwise
    const payload = parse<Types>(await readSystem()) ?? memory;
    if (!payload) {
        message.value = "Nothing to paste yet.";
        return;
    }
    const client = atPointer ? props.pointer.current : undefined;
    const at = client ? engine.get("screen-to-flow", client) : undefined;
    const { step, next } = cascade(place, at);
    const flow = model.get("flow-json");
    const taken = [...flow.nodes, ...flow.edges].map((entity) => entity.id);
    const copies = pasted(payload, taken, shiftFor(payload, step, at));
    // text from outside the page: checked as a whole document before it is loaded
    const issues = validateFlow(
        { version: 1, nodes: copies.nodes, edges: copies.edges },
        { features },
    );
    if (issues.length > 0) {
        message.value = "The clipboard holds an unreadable flow.";
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
        message.value = "The paste was refused.";
        return;
    }
    place = next;
    message.value = `Pasted ${counted(copies)}.`;
}

function onKeys(action: "copy" | "cut" | "paste") {
    if (typing(globalThis.document)) return;
    if (action === "paste") paste(true);
    else copy(action === "cut");
}

// the shortcuts: Ctrl on Windows and Linux, ⌘ on macOS; each acts once per press
const copyKeys = useKeyPress(["Control+c", "Meta+c"]);
const cutKeys = useKeyPress(["Control+x", "Meta+x"]);
const pasteKeys = useKeyPress(["Control+v", "Meta+v"]);
watch(copyKeys, (pressed) => {
    if (pressed) onKeys("copy");
});
watch(cutKeys, (pressed) => {
    if (pressed) onKeys("cut");
});
watch(pasteKeys, (pressed) => {
    if (pressed) onKeys("paste");
});
</script>

<template>
    <div
        role="toolbar"
        aria-label="Clipboard"
        data-flow-no-gesture=""
        :class="styles.panel"
    >
        <button
            type="button"
            :disabled="selected === 0"
            :class="styles.button"
            @click="copy(false)"
        >
            <CopyIcon />
            Copy
        </button>
        <button
            type="button"
            :disabled="selected === 0"
            :class="styles.button"
            @click="copy(true)"
        >
            <ScissorsIcon />
            Cut
        </button>
        <button type="button" :class="styles.button" @click="paste(false)">
            <ClipboardPasteIcon />
            Paste
        </button>
        <p role="status" data-testid="message" :class="styles.message">
            {{ message }}
        </p>
    </div>
</template>
