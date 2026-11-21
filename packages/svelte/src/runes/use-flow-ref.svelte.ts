import type { AnyTypes, FlowFeatures, FlowTypes } from "@fragiola/flow";
import { createFlowRef, type FlowRef } from "./create-flow-ref.svelte.js";

/**
 * A flow ref for this component: pass it as a `Flow.Root`'s `flowRef`, and read `flow.current` in
 * the template (a toolbar next to the flow, which updates when the root mounts) or in handlers.
 *
 * ```svelte
 * <script lang="ts">
 *     const flow = useFlowRef<Types>();
 * </script>
 *
 * <button type="button" disabled={!flow.current} onclick={() => flow.current?.engine.run("fit-view")}>
 *     Fit
 * </button>
 * <Flow.Root flowRef={flow} defaultNodes={nodes}>…</Flow.Root>
 * ```
 */
export function useFlowRef<
    T extends FlowTypes = AnyTypes,
    F extends FlowFeatures = readonly [],
>(): FlowRef<T, F> {
    return createFlowRef<T, F>();
}
