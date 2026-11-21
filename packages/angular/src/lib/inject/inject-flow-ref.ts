import type { AnyTypes, FlowFeatures, FlowTypes } from "@fragiola/flow";
import { createFlowRef, type FlowRef } from "./create-flow-ref";

/**
 * A flow ref kept by the component that makes it (React's `useFlowRef`): give it to a
 * `[flowRoot]` and read `flow.current` in the template (a toolbar next to the flow) or in
 * handlers. Its `current` is a signal's value, so the template follows the root as it attaches
 * and detaches; it is `createFlowRef()`, named for a field next to the other injection functions.
 *
 * ```ts
 * readonly flow = injectFlowRef<Types>();
 * // <button type="button" (click)="flow.current?.engine.run('fit-view')">Fit</button>
 * // <div flowRoot [flowRef]="flow" [defaultNodes]="nodes">…</div>
 * ```
 */
export function injectFlowRef<
    T extends FlowTypes = AnyTypes,
    F extends FlowFeatures = readonly [],
>(): FlowRef<T, F> {
    return createFlowRef<T, F>();
}
