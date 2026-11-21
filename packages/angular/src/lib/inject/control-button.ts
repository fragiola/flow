// The buttons of `[flowControls]`: each runs one engine action on its own click (before the app's
// `(click)`: a directive's host listener comes first), and is disabled while the engine refuses
// it (`engine.can`), updating when the view changes: the root renders the change of its click
// before the next task (`renderSoon`), so a button its click took to a limit never looks enabled
// meanwhile (a second click would do nothing).
import { computed, type Signal } from "@angular/core";
import type { EngineActionKey } from "@fragiola/flow";
import { injectFlowContext } from "../context";
import {
    bindAttributes,
    bindBaseAttributes,
    injectHost,
} from "../utils/helpers";
import { flowValue } from "./internal";

/** What a control button shows. */
export interface ControlButtonState {
    /** the engine refuses its action now (a zoom at its limit, `fit-view` before a size) */
    readonly disabled: boolean;
}

/** @internal a control button: its state, bound onto its element, and its click */
export function controlButton(
    part: string,
    action: EngineActionKey,
    disabledInput: () => boolean | undefined,
): { state: Signal<ControlButtonState>; click: () => void } {
    const context = injectFlowContext(`[flow${pascal(part)}]`);
    const host = injectHost<HTMLButtonElement>();
    const allowed = flowValue(context, () => {
        const engine = context.engine();
        return engine ? engine.can(action, {} as never) : false;
    });
    const state = computed(() => ({
        disabled: disabledInput() === true || !allowed(),
    }));
    bindAttributes(host, () => ({
        "data-flow-part": part,
        "data-disabled": state().disabled ? "" : undefined,
        disabled: state().disabled ? "" : undefined,
    }));
    bindBaseAttributes(host, () => ({ type: "button" }));
    return {
        state,
        click: () => {
            const engine = context.engine();
            if (!engine) return;
            engine.run(action, {} as never);
        },
    };
}

/** `zoom-in` → `ZoomIn`. */
function pascal(part: string): string {
    return part.replace(/(^|-)(\w)/g, (_match, _dash, letter: string) =>
        letter.toUpperCase(),
    );
}
