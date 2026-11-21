// `batch` (D6): several commands as one atomic step. They run in order on one draft, each through
// the middleware chain; the first failure fails the whole batch (nothing applies), and a success
// commits once, with one event listing every command it ran.
import { defineCommand, ok } from "./define";

export const batch = defineCommand({
    name: "batch",
    description:
        "Runs several commands as one atomic step: in order, all or nothing, with one event. The first failure is the batch's result, its path pointing into `commands`.",
    payloadSchema: {
        type: "object",
        properties: {
            commands: {
                type: "array",
                description:
                    "the commands, in order: each a `{ command, payload }`",
                items: {
                    type: "object",
                    properties: {
                        command: {
                            type: "string",
                            description: "the command's name",
                        },
                        payload: {
                            type: "object",
                            description: "its payload",
                        },
                    },
                    required: ["command", "payload"],
                    additionalProperties: false,
                },
            },
        },
        required: ["commands"],
        additionalProperties: false,
    },
    resultSchema: {
        type: "object",
        properties: {
            results: {
                type: "array",
                items: {},
                description: "each command's value, in order",
            },
        },
        required: ["results"],
        additionalProperties: false,
    },
    // transient when every command it runs may be (a multi-node drag's step)
    transient: true,
    reduce: ({ commands }, { runInBatch }) => {
        const results: unknown[] = [];
        for (const [i, entry] of commands.entries()) {
            const result = runInBatch(
                entry.command,
                entry.payload,
                `/commands/${i}`,
            );
            if (!result.ok) {
                return result;
            }
            results.push(result.value);
        }
        return ok({ results });
    },
});
