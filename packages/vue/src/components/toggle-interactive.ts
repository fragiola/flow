import { useFlowValue } from "../composables/internal";
import { useFlowContext } from "../context";
import {
    definePrimitive,
    type FlowComponent,
    type PrimitiveProps,
    type SlotFunction,
} from "../utils/primitive";
import { type RenderSlot, renderElement } from "../utils/render";

export interface ToggleInteractiveState {
    /** the gestures and keys may change the flow */
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
 * `data-interactive`): locks and unlocks the flow (`set-interactive`): while locked, gestures and
 * keys change nothing, pan and zoom stay. It renders only its default slot.
 */
export const ToggleInteractive: FlowComponent<
    ToggleInteractiveProps,
    ToggleInteractiveSlots
> = definePrimitive<ToggleInteractiveProps, ToggleInteractiveSlots>(
    "ToggleInteractive",
    ["as"],
    (props, { attrs, slots }) => {
        const context = useFlowContext("ToggleInteractive");
        const interactive = useFlowValue(
            context,
            () => context.engine.value?.is("interactive") ?? true,
        );
        const onClick = () => {
            context.engine.value?.run("set-interactive", {
                interactive: !interactive.value,
            });
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
