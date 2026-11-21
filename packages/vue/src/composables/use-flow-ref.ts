// From Tree (fragiola/tree, packages/vue/src/composables/use-tree-ref.ts), same author and licence.
import type { AnyTypes, FlowFeatures, FlowTypes } from "@fragiola/flow";
import { createFlowRef, type FlowRef } from "./create-flow-ref";

/**
 * A flow ref for this component: pass it as a `Flow.Root`'s `flow-ref`, and read `flow.value` in
 * the template (a toolbar next to the flow, which re-renders when the root mounts) or in handlers.
 * A template does not unwrap a flow ref: it reads `flow.value`, as a script does.
 *
 * ```vue
 * <script setup lang="ts">
 * const flow = useFlowRef<Types>();
 * </script>
 * <template>
 *     <button type="button" :disabled="!flow.value" @click="flow.value?.engine.run('fit-view')">
 *         Fit
 *     </button>
 *     <Flow.Root :flow-ref="flow" :default-nodes="nodes">…</Flow.Root>
 * </template>
 * ```
 */
export function useFlowRef<
    T extends FlowTypes = AnyTypes,
    F extends FlowFeatures = readonly [],
>(): FlowRef<T, F> {
    return createFlowRef<T, F>();
}
