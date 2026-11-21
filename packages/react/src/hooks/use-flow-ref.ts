// From Tree (fragiola/tree, packages/react/src/hooks/use-tree-ref.ts), same author and licence.
import type { AnyTypes, FlowFeatures, FlowTypes } from "@fragiola/flow";
import * as React from "react";
import {
    createFlowRef,
    type FlowRef,
    subscribeFlowRef,
} from "./create-flow-ref";

/**
 * A flow ref kept by this component, which re-renders when the `Flow.Root` it is given to mounts
 * or unmounts: read `flow.current` in render (a toolbar next to the flow) or in handlers.
 *
 * ```tsx
 * const flow = useFlowRef<Types>();
 * <button type="button" onClick={() => flow.current?.engine.run("fit-view")}>Fit</button>
 * <Flow.Root flowRef={flow} defaultNodes={nodes}>…</Flow.Root>
 * ```
 */
export function useFlowRef<
    T extends FlowTypes = AnyTypes,
    F extends FlowFeatures = readonly [],
>(): FlowRef<T, F> {
    const [ref] = React.useState(() => createFlowRef<T, F>());
    const subscribe = React.useCallback(
        (onChange: () => void) =>
            subscribeFlowRef(
                ref as unknown as FlowRef<FlowTypes, FlowFeatures>,
                onChange,
            ),
        [ref],
    );
    const snapshot = () => ref.current;
    React.useSyncExternalStore(subscribe, snapshot, () => null);
    return ref;
}
