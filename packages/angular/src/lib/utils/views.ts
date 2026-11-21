// The views of a collection part (`flowNodesItem`, `flowEdgesItem`): one per entity, keyed by its
// id, each in a root view of its own. Angular refreshes a template's embedded views with their
// component (a signal read in one marks the component), so a node's view in the app's component
// would be checked again on every drag step of any node; in a view of its own (a `FlowSlot`
// attached to the application), only the view whose node changed is. The views are still checked
// whenever the app's component is (`markForCheck` from the directive's `ngDoCheck`), as embedded
// views are. Their elements are placed by the part, in order, before its template's anchor.
// `SignalContext` is from Dockable (fragiola/dockable, packages/angular/src/lib/utils/views.ts),
// same author and licence.
import {
    ApplicationRef,
    ChangeDetectionStrategy,
    Component,
    type ComponentRef,
    createComponent,
    type EmbeddedViewRef,
    EnvironmentInjector,
    Injector,
    inject,
    signal,
    type TemplateRef,
    untracked,
    ViewContainerRef,
    type WritableSignal,
} from "@angular/core";

/**
 * A template context whose fields are signals behind getters: a view reads them while it renders,
 * so setting a field renders that view again, and nothing else.
 */
export class SignalContext<V extends object> {
    private readonly fields: { [K in keyof V]: WritableSignal<V[K]> };

    constructor(initial: V) {
        const fields = {} as { [K in keyof V]: WritableSignal<V[K]> };
        for (const key of Object.keys(initial) as (keyof V)[]) {
            fields[key] = signal(initial[key]);
            Object.defineProperty(this, key, {
                enumerable: true,
                get: () => fields[key](),
            });
        }
        this.fields = fields;
    }

    /** Sets the fields that changed. */
    update(next: V): void {
        for (const key of Object.keys(next) as (keyof V)[]) {
            const field = this.fields[key];
            if (!Object.is(untracked(field), next[key])) {
                field.set(next[key]);
            }
        }
    }
}

/** A {@link SignalContext}, seen as the context type its template declares. */
export function signalContext<V extends object>(
    initial: V,
): SignalContext<V> & V {
    return new SignalContext(initial) as SignalContext<V> & V;
}

/**
 * The root view an entity's view lives in: a component with no template whose host stays out of
 * the document; its container (next to its host) holds the entity's view, whose elements are
 * moved to their place.
 */
@Component({
    selector: "flow-slot",
    template: "",
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FlowSlot {
    /** @internal where the entity's view is created */
    readonly container = inject(ViewContainerRef);
}

interface Slot<C extends object> {
    readonly ref: ComponentRef<FlowSlot>;
    /** where its view's elements are made, out of the document */
    readonly box: HTMLElement;
    readonly view: EmbeddedViewRef<SignalContext<C> & C>;
}

/** The views of a template, one per key, each in a root view of its own, placed before `anchor`. */
export class SlotViews<C extends object> {
    private readonly slots = new Map<string, Slot<C>>();
    private readonly app = inject(ApplicationRef);
    private readonly environmentInjector = inject(EnvironmentInjector);
    private readonly elementInjector = inject(Injector);

    constructor(
        private readonly anchor: Comment,
        private readonly template: TemplateRef<C>,
    ) {}

    /** Brings the views to `items`, in their order: a key that stays keeps its view and its elements. */
    sync(items: readonly { key: string; context: C }[]): void {
        untracked(() => {
            const keep = new Set(items.map((item) => item.key));
            for (const [key, slot] of this.slots) {
                if (!keep.has(key)) {
                    slot.ref.destroy();
                    this.slots.delete(key);
                }
            }
            const ordered: Slot<C>[] = [];
            for (const { key, context } of items) {
                let slot = this.slots.get(key);
                if (slot) {
                    slot.view.context.update(context);
                } else {
                    slot = this.create(context);
                    this.slots.set(key, slot);
                }
                ordered.push(slot);
            }
            // in order, from the last: each view's elements before the next one's
            let next: Node = this.anchor;
            const parent = this.anchor.parentNode;
            for (let i = ordered.length - 1; i >= 0; i--) {
                const slot = ordered[i];
                // a root element a part moved elsewhere (a label into the edges' HTML layer, a
                // toolbar into the root) stays there: its comment keeps its place here
                const nodes = ((slot?.view.rootNodes ?? []) as Node[]).filter(
                    (node) =>
                        node.parentNode === parent ||
                        node.parentNode === slot?.box,
                );
                const last = nodes.at(-1);
                if (last && last.nextSibling !== next) {
                    for (const node of nodes) {
                        next.parentNode?.insertBefore(node, next);
                    }
                }
                next = nodes[0] ?? next;
            }
        });
    }

    /** Has every view checked with the next render (its component was). */
    markForCheck(): void {
        for (const slot of this.slots.values()) {
            slot.ref.changeDetectorRef.markForCheck();
        }
    }

    clear(): void {
        for (const slot of this.slots.values()) slot.ref.destroy();
        this.slots.clear();
    }

    private create(context: C): Slot<C> {
        const document = this.anchor.ownerDocument;
        // the slot's host, and the view next to it, stay out of the document
        const box = document.createElement("div");
        const host = document.createElement("flow-slot");
        box.append(host);
        const ref = createComponent(FlowSlot, {
            environmentInjector: this.environmentInjector,
            elementInjector: this.elementInjector,
            hostElement: host,
        });
        this.app.attachView(ref.hostView);
        const view = ref.instance.container.createEmbeddedView(
            this.template as unknown as TemplateRef<SignalContext<C> & C>,
            signalContext(context),
        );
        ref.changeDetectorRef.markForCheck();
        return { ref, box, view };
    }
}
