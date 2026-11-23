// The composables and helpers only the primitives call.
import type { FlowEdge, RenderLayer } from "@fragiola/flow";
import { type ComputedRef, computed, watch } from "vue";
import type { FlowContextValue } from "../context";
import type { FlowEntity, FlowValueScope } from "../utils/flow-store";
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
 * by default). It is read again on every change that may concern its `scope` (the root's store:
 * `view`, every commit of the model and every view change of the engine; `entity`, a node's or an
 * edge's own view, not read again on a viewport step, and given its node or edge (`entity`, a
 * getter), not on a measurement that leaves it alone), when the engine is created, and when a
 * reactive value the reader uses changes (a prop); a value equal to the last one keeps the last
 * object, so nothing re-renders.
 */
export function useFlowValue<S>(
    context: FlowContextValue,
    read: () => S,
    isEqual: (a: S, b: S) => boolean = sameValue,
    scope: FlowValueScope = "view",
    entity?: () => FlowEntity | undefined,
): ComputedRef<S> {
    const { store } = context;
    if (scope === "entity" && entity) {
        // its record is kept while it reads it (another node or edge: the other record)
        watch(
            () => {
                const of = entity();
                return of ? `${of.kind}\u0000${of.id}` : undefined;
            },
            (_key, _previous, onCleanup) => {
                const of = entity();
                if (of) onCleanup(store.acquire(of));
            },
            { immediate: true },
        );
    }
    let last: { value: S } | undefined;
    return computed(() => {
        if (scope === "view") {
            store.view.value;
        } else {
            store.entity.value;
            const of = entity?.();
            (of ? store.counterOf(of) : store.measure).value;
        }
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
 * exists the static geometry's (a server render, the first client render; no edge with
 * `onlyRenderVisible`)
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
            // before the engine, a culled flow draws no edge (its levels kept, empty): the view
            // is not known yet
            const edges = engine
                ? engine.get("drawn-edges")
                : context.onlyRenderVisible.value
                  ? []
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
