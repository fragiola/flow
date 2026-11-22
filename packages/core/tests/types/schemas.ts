// Type fixtures (compiled by `pnpm typecheck`, never run): each command's hand-written JSON Schema,
// read back as a type with FromSchema, is the command's payload type (and result type), and the
// document's schema is the document's type. A schema that drifts from its type fails the
// typecheck. (`batch` is left out: its schema says `{ command, payload }`, its type is the union
// of every command's.)
import type {
    edgeAdd,
    edgeRemove,
    edgeSetData,
    edgeSetFlags,
    edgeSetZIndex,
} from "../../src/commands/edge";
import type {
    nodeAdd,
    nodeMove,
    nodeRemove,
    nodeResize,
    nodeSetData,
    nodeSetFlags,
    nodeSetZIndex,
} from "../../src/commands/node";
import type {
    CommandName,
    PayloadOf,
    ResultOf,
} from "../../src/commands/types";
import type {
    edgeSchema,
    flowDocumentSchema,
    nodeSchema,
} from "../../src/document/document-schema";
import type {
    AnyTypes,
    FlowEdgeInput,
    FlowJson,
    FlowNodeInput,
} from "../../src/document/types";
import type { edgeReconnect } from "../../src/reconnection/commands";
import type { FromSchema } from "../../src/schema/from-schema";
import type {
    selectionClear,
    selectionRemove,
    selectionSet,
} from "../../src/selection/commands";
import type { nodeSetParent } from "../../src/subflows/commands";

/** Mutually assignable, with the same keys. */
type Same<A, B> = [A] extends [B]
    ? [B] extends [A]
        ? [keyof A] extends [keyof B]
            ? [keyof B] extends [keyof A]
                ? true
                : false
            : false
        : false
    : false;

type Check<
    C extends CommandName,
    D extends { payloadSchema: unknown; resultSchema: unknown },
> = [
    Same<FromSchema<D["payloadSchema"]>, PayloadOf<AnyTypes, C>>,
    Same<FromSchema<D["resultSchema"]>, ResultOf<AnyTypes, C>>,
];

/** Compiles only when every entry is `[true, true]`. */
export type SchemasMatchTypes = [
    Check<"node.add", typeof nodeAdd>,
    Check<"node.remove", typeof nodeRemove>,
    Check<"node.move", typeof nodeMove>,
    Check<"node.resize", typeof nodeResize>,
    Check<"node.set-data", typeof nodeSetData>,
    Check<"node.set-flags", typeof nodeSetFlags>,
    Check<"node.set-z-index", typeof nodeSetZIndex>,
    Check<"node.set-parent", typeof nodeSetParent>,
    Check<"edge.add", typeof edgeAdd>,
    Check<"edge.remove", typeof edgeRemove>,
    Check<"edge.reconnect", typeof edgeReconnect>,
    Check<"edge.set-data", typeof edgeSetData>,
    Check<"edge.set-flags", typeof edgeSetFlags>,
    Check<"edge.set-z-index", typeof edgeSetZIndex>,
    Check<"selection.set", typeof selectionSet>,
    Check<"selection.clear", typeof selectionClear>,
    Check<"selection.remove", typeof selectionRemove>,
] extends [true, true][]
    ? true
    : never;

export const schemasMatchTypes: SchemasMatchTypes = true;

/** The document's schema is the document's type, and a node's and an edge's are theirs. */
export const documentMatchesType: [
    Same<FromSchema<typeof flowDocumentSchema>, FlowJson>,
    Same<FromSchema<typeof nodeSchema>, FlowNodeInput>,
    Same<FromSchema<typeof edgeSchema>, FlowEdgeInput>,
] = [true, true, true];
