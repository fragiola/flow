import { batch } from "./batch";
import type { CommandDefinition } from "./define";
import { edgeAdd, edgeRemove, edgeSetData, edgeSetFlags } from "./edge";
import {
    nodeAdd,
    nodeMove,
    nodeRemove,
    nodeResize,
    nodeSetData,
    nodeSetFlags,
} from "./node";
import type { CommandName } from "./types";

/**
 * The core's commands, in the order `model.get("commands")` lists them (an installed feature's
 * follow, in install order). Each definition keeps its schemas' literal types (the type tests read
 * them); the list erases them to `CommandDefinition` once.
 */
export const CORE_COMMANDS: readonly CommandDefinition[] = [
    nodeAdd,
    nodeRemove,
    nodeMove,
    nodeResize,
    nodeSetData,
    nodeSetFlags,
    edgeAdd,
    edgeRemove,
    edgeSetData,
    edgeSetFlags,
    batch,
] as const satisfies readonly {
    readonly name: CommandName;
    readonly transient: boolean;
    readonly reduce: (...args: never[]) => unknown;
}[] as readonly unknown[] as readonly CommandDefinition[];
