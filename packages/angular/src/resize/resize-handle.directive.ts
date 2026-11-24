import { computed, Directive, input, type Signal } from "@angular/core";
import {
    type ResizeHandleDirection,
    type ResizeHandleVariant,
    resizeHandleAttributes,
} from "@fragiola/flow";
import {
    ɵbeforeInputs as beforeInputs,
    ɵbindAttributes as bindAttributes,
    ɵbindStructuralStyle as bindStructuralStyle,
    type ɵFlowContext as FlowContext,
    ɵflowValue as flowValue,
    ɵinjectFlowContext as injectFlowContext,
    ɵinjectHost as injectHost,
    ɵinjectNodeContext as injectNodeContext,
    ɵpartOwnerId as partOwnerId,
    type StructuralStyle,
} from "@fragiola/flow-angular";

/** A corner or a side of a node a resize handle moves. */
export type ResizePosition =
    | "top-left"
    | "top"
    | "top-right"
    | "right"
    | "bottom-right"
    | "bottom"
    | "bottom-left"
    | "left";

/** Every position, corners then sides. */
export const RESIZE_POSITIONS: readonly ResizePosition[] = Object.freeze([
    "top-left",
    "top-right",
    "bottom-right",
    "bottom-left",
    "top",
    "right",
    "bottom",
    "left",
]);

export interface ResizeHandleState {
    readonly nodeId: string;
    readonly position: ResizePosition;
    /** its own direction, over its resizer's (`data-direction`); none: the resizer's */
    readonly direction: ResizeHandleDirection | undefined;
    /** how it is drawn (`data-variant`): a corner is always a `handle` */
    readonly variant: ResizeHandleVariant;
}

/** A resize handle's own direction and variant (`bindResizeHandle`). */
export interface ResizeHandleLook {
    readonly direction?: ResizeHandleDirection | undefined;
    readonly variant?: ResizeHandleVariant | undefined;
}

/**
 * Where a handle sits: a corner's centre on the corner, a side's along the side. A corner is above
 * the two sides it joins (`zIndex`), so a press on it resizes both dimensions, whatever the order
 * of the handles.
 */
const PLACE: Record<ResizePosition, StructuralStyle> = {
    "top-left": {
        top: 0,
        left: 0,
        transform: "translate(-50%, -50%)",
        zIndex: 1,
    },
    "top-right": {
        top: 0,
        left: "100%",
        transform: "translate(-50%, -50%)",
        zIndex: 1,
    },
    "bottom-right": {
        top: "100%",
        left: "100%",
        transform: "translate(-50%, -50%)",
        zIndex: 1,
    },
    "bottom-left": {
        top: "100%",
        left: 0,
        transform: "translate(-50%, -50%)",
        zIndex: 1,
    },
    top: { top: 0, left: 0, width: "100%", transform: "translateY(-50%)" },
    bottom: {
        top: "100%",
        left: 0,
        width: "100%",
        transform: "translateY(-50%)",
    },
    left: { top: 0, left: 0, height: "100%", transform: "translateX(-50%)" },
    right: {
        top: 0,
        left: "100%",
        height: "100%",
        transform: "translateX(-50%)",
    },
};

/**
 * @internal binds a resize handle of the node `nodeId` onto `element`: the engine's record
 * (`data-position`, `data-variant`, `data-direction`, and `tabindex` with `keyboard()`: the
 * arrows resize)
 */
export function bindResizeHandle(
    element: HTMLElement,
    context: FlowContext,
    nodeId: () => string | undefined,
    position: () => ResizePosition | undefined,
    look: () => ResizeHandleLook = () => ({}),
): void {
    const attributes = flowValue(
        context,
        () => {
            const id = nodeId();
            const at = position();
            const { direction, variant } = look();
            const engine = context.engine();
            return engine && id !== undefined && at !== undefined
                ? engine.adapter.attributes("resize-handle", {
                      nodeId: id,
                      position: at,
                      direction,
                      variant,
                  })
                : resizeHandleAttributes(at, { direction, variant });
        },
        undefined,
        { scope: "entity" },
    );
    bindAttributes(element, attributes);
    bindStructuralStyle(element, () => {
        const at = position();
        return {
            position: "absolute",
            pointerEvents: "auto",
            ...(at ? PLACE[at] : {}),
        };
    });
}

/**
 * A grab area of a `[flowNodeResizer]` (`data-flow-part="resize-handle"`, `data-position`), on
 * the app's element: `<div flowResizeHandle position="bottom-right">`. A press on it resizes its
 * node from that corner or side (`resize()`); with `keyboard()` too it takes focus and the arrows
 * move that corner or side. Placed on its corner (centred) or along its side; give it its size (a
 * side's thickness) and look. Its `direction` overrides its resizer's; `variant="line"` marks a
 * side's handle as a line for your styles.
 */
@Directive({ selector: "[flowResizeHandle]", exportAs: "flowResizeHandle" })
export class FlowResizeHandleDirective {
    /** the corner or side it moves */
    readonly position = input.required<ResizePosition>();
    /** its node; default the enclosing `[flowNode]`'s */
    readonly nodeId = input<string | undefined>(undefined);
    /**
     * the sides it moves, over its resizer's `direction` (`data-direction`): `"horizontal"` only
     * the width (and x), `"vertical"` only the height (and y); default the resizer's
     */
    readonly direction = input<ResizeHandleDirection | undefined>(undefined);
    /**
     * how it is drawn (`data-variant`, for your styles): `"handle"` (default) or `"line"`, a
     * side's whole length; a corner's `"line"` is ignored
     */
    readonly variant = input<ResizeHandleVariant | undefined>(undefined);

    private readonly id = partOwnerId(
        "[flowResizeHandle]",
        this.nodeId,
        injectNodeContext(),
        "node",
    );
    private readonly at = computed(() =>
        beforeInputs(undefined, this.position),
    );
    private readonly look = computed(
        (): ResizeHandleLook => ({
            direction: this.direction(),
            variant: this.variant(),
        }),
    );

    /** the handle's state */
    readonly state: Signal<ResizeHandleState | undefined> = computed(() => {
        const nodeId = this.id();
        const position = this.at();
        if (nodeId === undefined || position === undefined) return undefined;
        const own = resizeHandleAttributes(position, this.look());
        return {
            nodeId,
            position,
            direction: own["data-direction"] as
                | ResizeHandleDirection
                | undefined,
            variant: own["data-variant"] as ResizeHandleVariant,
        };
    });

    constructor() {
        bindResizeHandle(
            injectHost(),
            injectFlowContext("[flowResizeHandle]"),
            this.id,
            this.at,
            this.look,
        );
    }
}
