import { useFlowValue } from "../composables/internal";
import { useFlowContext } from "../context";
import {
    definePrimitive,
    type FlowComponent,
    type PrimitiveProps,
    type SlotFunction,
} from "../utils/primitive";
import { type RenderSlot, renderElement } from "../utils/render";

/** The switches the lock turns off and on (React Flow's: dragging, connecting, selecting). */
const LOCKED_KINDS = ["drag", "connect", "select"] as const;

export interface ToggleInteractiveState {
    /**
     * the flow is not locked: it is interactive and one of dragging, connecting and selecting at
     * least is on (`interactive-by`)
     */
    readonly interactive: boolean;
}

export interface ToggleInteractiveProps extends PrimitiveProps {}

export interface ToggleInteractiveSlots
    extends RenderSlot<ToggleInteractiveState> {
    /** its content (an icon, a label) */
    default?: SlotFunction<{ state: ToggleInteractiveState }>;
}

/**
 * A toggle button (`data-flow-part="toggle-interactive"`, `aria-pressed` while the flow is locked,
 * `data-interactive`): locks and unlocks the flow, React Flow's interactive button: locking turns
 * dragging, connecting and selecting off (`set-interactive { drag, connect, select }`), unlocking
 * turns them and `interactive` on; pan and zoom stay. It renders only its default slot.
 */
export const ToggleInteractive: FlowComponent<
    ToggleInteractiveProps,
    ToggleInteractiveSlots
> = definePrimitive<ToggleInteractiveProps, ToggleInteractiveSlots>(
    "ToggleInteractive",
    ["as"],
    (props, { attrs, slots }) => {
        const context = useFlowContext("ToggleInteractive");
        const interactive = useFlowValue(context, () => {
            const engine = context.engine.value;
            return engine
                ? LOCKED_KINDS.some((kind) =>
                      engine.is("interactive-by", { kind }),
                  )
                : true;
        });
        const onClick = () => {
            context.engine.value?.run(
                "set-interactive",
                interactive.value
                    ? { drag: false, connect: false, select: false }
                    : {
                          interactive: true,
                          drag: true,
                          connect: true,
                          select: true,
                      },
            );
        };
        return () => {
            const state: ToggleInteractiveState = {
                interactive: interactive.value,
            };
            return renderElement({
                tag: "button",
                as: props.as,
                attrs,
                render: slots.render,
                state,
                props: {
                    type: "button",
                    "data-flow-part": "toggle-interactive",
                    "data-interactive": state.interactive ? "" : undefined,
                    "aria-pressed": String(!state.interactive),
                    disabled: context.engine.value === null,
                    onClick,
                },
                children: () => slots.default?.({ state }),
            });
        };
    },
);
