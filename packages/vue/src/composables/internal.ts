// The composables and helpers only the primitives call.
import type { FlowEdge, RenderLayer } from "@fragiola/flow";
import { type ComputedRef, computed } from "vue";
import type { FlowContextValue } from "../context";
import { shallowEqual } from "../utils/shallow-equal";

/** @internal two values the same for re-rendering: records compared by their entries */
export function sameValue<S>(a: S, b: S): boolean {
    if (Object.is(a, b)) return true;
    if (
        typeof a === "object" &&
        typeof b === "object" &&
        a !== null &&
        b !== null &&
        !Array.isArray(a) &&
        !Array.isArray(b)
    ) {
        return shallowEqual(
            a as Readonly<Record<string, unknown>>,
            b as Readonly<Record<string, unknown>>,
        );
    }
    if (Array.isArray(a) && Array.isArray(b)) {
        return (
            a.length === b.length &&
            a.every((value, i) => Object.is(value, b[i]))
        );
    }
    return false;
}

/**
 * @internal a value read from the model and the engine (the React adapter's `useFlowValue`), as a
 * computed ref that triggers its readers only when it changes (`isEqual`; records by their entries
 * by default). It is read again on every commit of the model and every view change of the engine
 * (the root's `revision`), when the engine is created, and when a reactive value the reader uses
 * changes (a prop); a value equal to the last one keeps the last object, so nothing re-renders.
 */
export function useFlowValue<S>(
    context: FlowContextValue,
    read: () => S,
    isEqual: (a: S, b: S) => boolean = sameValue,
): ComputedRef<S> {
    let last: { value: S } | undefined;
    return computed(() => {
        context.revision.value;
        context.engine.value;
        const value = read();
        if (last !== undefined && isEqual(last.value, value)) {
            return last.value;
        }
        last = { value };
        return value;
    });
}

/** @internal one render level as the parts draw it: its edges, in drawing order */
export interface DrawnLayer {
    readonly level: number;
    readonly zIndex: number | undefined;
    readonly edges: readonly FlowEdge[];
}

function sameLayers(
    a: readonly DrawnLayer[],
    b: readonly DrawnLayer[],
): boolean {
    return (
        a.length === b.length &&
        a.every((layer, i) => {
            const other = b[i];
            return (
                other !== undefined &&
                layer.level === other.level &&
                layer.zIndex === other.zIndex &&
                sameValue(layer.edges, other.edges)
            );
        })
    );
}

/**
 * @internal the render levels (`render-layers`) with their edges: the engine's, or before it
 * exists the static geometry's (a server render, the first client render)
 */
export function useDrawnLayers(
    context: FlowContextValue,
): ComputedRef<readonly DrawnLayer[]> {
    return useFlowValue(
        context,
        () => {
            const engine = context.engine.value;
            const layers: readonly RenderLayer[] = engine
                ? engine.get("render-layers")
                : (context.geometry.value?.layers ?? []);
            const edges = engine
                ? engine.get("drawn-edges")
                : context.model.get("all-edges");
            const byId = new Map(edges.map((edge) => [edge.id, edge]));
            return layers.map((layer) => ({
                level: layer.level,
                zIndex: layer.zIndex,
                edges: layer.edgeIds.flatMap((id) => {
                    const edge = byId.get(id);
                    return edge ? [edge] : [];
                }),
            }));
        },
        sameLayers,
    );
}
