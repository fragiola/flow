import {
    Component,
    computed,
    DestroyRef,
    DOCUMENT,
    inject,
    input,
    signal,
} from "@angular/core";
import {
    type BatchEntry,
    injectFlow,
    injectSelection,
    validateFlow,
    watchKeyPress,
} from "@fragiola/flow-angular";
import {
    LucideClipboardPaste,
    LucideCopy,
    LucideScissors,
} from "@lucide/angular";
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
import { features, type PointerRef, type Types } from "./index";
import { styles } from "./styles";

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

/** The toolbar and the shortcuts: copy, cut and paste, and what the last one did. */
@Component({
    selector: "example-clipboard-toolbar",
    imports: [LucideClipboardPaste, LucideCopy, LucideScissors],
    host: { class: "contents" },
    template: `
        <div role="toolbar" aria-label="Clipboard" data-flow-no-gesture="" [class]="styles.panel">
            <button
                type="button"
                [disabled]="selected() === 0"
                (click)="copy(false)"
                [class]="styles.button"
            >
                <svg lucideCopy aria-hidden="true"></svg>
                Copy
            </button>
            <button
                type="button"
                [disabled]="selected() === 0"
                (click)="copy(true)"
                [class]="styles.button"
            >
                <svg lucideScissors aria-hidden="true"></svg>
                Cut
            </button>
            <button type="button" (click)="paste(false)" [class]="styles.button">
                <svg lucideClipboardPaste aria-hidden="true"></svg>
                Paste
            </button>
            <p role="status" data-testid="message" [class]="styles.message">{{ message() }}</p>
        </div>
    `,
})
export class ClipboardToolbar {
    readonly pointer = input.required<PointerRef>();

    protected readonly styles = styles;
    private readonly flow = injectFlow<Types, typeof features>();
    private readonly selection = injectSelection<Types>();
    protected readonly selected = computed(() => this.selection().nodes.length);
    protected readonly message = signal("Select nodes, then copy them.");
    // the example's own state, never rendered: the in-memory copy, where the next paste goes, the
    // pastes waiting for the one before them, and whether the toolbar is still there (a paste
    // waiting on the system clipboard does nothing once it is gone)
    private memory: Payload<Types> | undefined;
    private place: Cascade = afterCopy;
    private queue: Promise<void> = Promise.resolve();
    private destroyed = false;

    constructor() {
        // the shortcuts: Ctrl on Windows and Linux, ⌘ on macOS; each acts once per press, in the
        // key's own event (`watchKeyPress`, which `injectKeyPress` wraps: its signal read by an
        // effect would miss a press released before Angular's next render)
        const window = inject(DOCUMENT).defaultView;
        const watch = (keys: string[], action: "copy" | "cut" | "paste") =>
            window
                ? watchKeyPress(window, keys, (pressed) => {
                      if (pressed) this.onKeys(action);
                  })
                : () => {};
        const stops = [
            watch(["Control+c", "Meta+c"], "copy"),
            watch(["Control+x", "Meta+x"], "cut"),
            watch(["Control+v", "Meta+v"], "paste"),
        ];
        inject(DestroyRef).onDestroy(() => {
            this.destroyed = true;
            for (const stop of stops) stop();
        });
    }

    protected copy(cut: boolean): void {
        const model = this.flow.model();
        const ids = model.get("selected-nodes").map((node) => node.id);
        if (ids.length === 0) {
            this.message.set("Select nodes to copy.");
            return;
        }
        const { nodes, edges } = model.get("flow-json");
        const payload = copyOf(nodes, edges, ids);
        this.memory = payload;
        this.place = cut ? afterCut : afterCopy;
        void writeSystem(serialize(payload));
        if (cut) model.run("selection.remove", {});
        this.message.set(`${cut ? "Cut" : "Copied"} ${counted(payload)}.`);
    }

    /** Pastes once the paste before it is done, so two quick presses never share ids. */
    protected paste(atPointer: boolean): void {
        this.queue = this.queue.then(() => this.pasteNow(atPointer));
    }

    private async pasteNow(atPointer: boolean): Promise<void> {
        // the system clipboard first (another tab's copy), this page's own copy otherwise
        const text = await readSystem();
        if (this.destroyed) return;
        const payload = parse<Types>(text) ?? this.memory;
        if (!payload) {
            this.message.set("Nothing to paste yet.");
            return;
        }
        const { engine } = this.flow;
        const model = this.flow.model();
        const client = atPointer ? this.pointer().current : undefined;
        const at = client ? engine.get("screen-to-flow", client) : undefined;
        const { step, next } = cascade(this.place, at);
        const json = model.get("flow-json");
        const taken = [...json.nodes, ...json.edges].map((entity) => entity.id);
        const copies = pasted(payload, taken, shiftFor(payload, step, at));
        // text from outside the page: checked as a whole document before it is loaded
        const issues = validateFlow(
            { version: 1, nodes: copies.nodes, edges: copies.edges },
            { features },
        );
        if (issues.length > 0) {
            this.message.set("The clipboard holds an unreadable flow.");
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
            this.message.set("The paste was refused.");
            return;
        }
        this.place = next;
        this.message.set(`Pasted ${counted(copies)}.`);
    }

    private onKeys(action: "copy" | "cut" | "paste"): void {
        if (typing(globalThis.document)) return;
        if (action === "paste") this.paste(true);
        else this.copy(action === "cut");
    }
}
