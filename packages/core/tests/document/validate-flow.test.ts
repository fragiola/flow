import { describe, expect, it } from "vitest";
import { validateFlow } from "../../src/document/validate-flow";
import { selection } from "../../src/selection/selection";
import { subflows } from "../../src/subflows/subflows";
import { chain, task } from "../fixture";

describe("validateFlow", () => {
    it("finds nothing wrong in a valid document", () => {
        expect(validateFlow(chain())).toEqual([]);
        expect(validateFlow({ version: 1, nodes: [], edges: [] })).toEqual([]);
    });

    it("reports every schema problem with its JSON path", () => {
        expect(
            validateFlow({
                version: 2,
                nodes: [
                    { type: "", position: { x: "0" }, data: {}, color: "red" },
                ],
            }),
        ).toEqual([
            { path: "/edges", message: "is required" },
            { path: "/version", message: "must be 1" },
            {
                path: "/nodes/0/type",
                message: "must have at least 1 character(s)",
            },
            { path: "/nodes/0/position/y", message: "is required" },
            { path: "/nodes/0/position/x", message: "must be a number" },
            { path: "/nodes/0/color", message: "is not allowed" },
        ]);
        expect(validateFlow(null)).toEqual([
            { path: "", message: "must be an object" },
        ]);
    });

    it("refuses duplicate ids, edges to missing nodes and two edges between the same handles", () => {
        const json = chain();
        json.nodes.push(task("a", 9));
        json.edges.push({ id: "ab", source: "a", target: "zz" });
        expect(validateFlow(json)).toEqual([
            {
                path: "/nodes/3/id",
                message: "duplicates the id of node /nodes/0",
            },
            {
                path: "/edges/2/id",
                message: "duplicates the id of edge /edges/0",
            },
            { path: "/edges/2/target", message: 'no node "zz"' },
        ]);
        const dangling = chain();
        dangling.edges.push(
            { source: "a", target: "zz" },
            { source: "a", target: "b" },
            { source: "a", target: "b", sourceHandle: "out" },
        );
        expect(validateFlow(dangling)).toEqual([
            { path: "/edges/2/target", message: 'no node "zz"' },
            {
                path: "/edges/3",
                message: "joins the same handles as edge /edges/0",
            },
        ]);
    });

    it("reports every problem in one pass: a schema issue does not hide an edge to a missing node", () => {
        expect(
            validateFlow({
                version: 1,
                nodes: [
                    {
                        id: "a",
                        type: "t",
                        position: { x: "1", y: 0 },
                        data: {},
                    },
                    7,
                ],
                edges: [{ source: "a", target: "zz" }, null],
            }),
        ).toEqual([
            { path: "/nodes/0/position/x", message: "must be a number" },
            { path: "/nodes/1", message: "must be an object" },
            { path: "/edges/1", message: "must be an object" },
            { path: "/edges/0/target", message: 'no node "zz"' },
        ]);
    });

    it("refuses a feature's field without its feature, naming it", () => {
        const json = chain();
        json.nodes[0] = task("a", 0, 0, { selected: true, parentId: "b" });
        json.edges[0] = { id: "ab", source: "a", target: "b", selected: true };
        expect(validateFlow(json)).toEqual([
            {
                path: "/nodes/0/selected",
                message:
                    "requires the selection feature (`@fragiola/flow/selection`)",
            },
            {
                path: "/nodes/0/parentId",
                message:
                    "requires the subflows feature (`@fragiola/flow/subflows`)",
            },
            {
                path: "/edges/0/selected",
                message:
                    "requires the selection feature (`@fragiola/flow/selection`)",
            },
        ]);
        expect(
            validateFlow(json, { features: [selection(), subflows()] }),
        ).toEqual([]);
    });

    it("checks the installed features' rules: a missing parent, a cycle of parents", () => {
        const json = {
            version: 1,
            nodes: [
                task("a", 0, 0, { parentId: "b" }),
                task("b", 0, 0, { parentId: "a" }),
                task("c", 0, 0, { parentId: "zz" }),
            ],
            edges: [],
        };
        expect(validateFlow(json, { features: [subflows()] })).toEqual([
            {
                path: "/nodes/0/parentId",
                message: 'node "a" is its own ancestor',
            },
            {
                path: "/nodes/1/parentId",
                message: 'node "b" is its own ancestor',
            },
            { path: "/nodes/2/parentId", message: 'no node "zz"' },
        ]);
    });

    it("refuses a selected node or edge that is not selectable, with selection()", () => {
        const json = chain();
        json.nodes[0] = task("a", 0, 0, { selected: true, selectable: false });
        json.edges[0] = {
            id: "ab",
            source: "a",
            target: "b",
            selected: true,
            selectable: false,
        };
        expect(validateFlow(json, { features: [selection()] })).toEqual([
            {
                path: "/nodes/0/selected",
                message: "is selected, but not selectable",
            },
            {
                path: "/edges/0/selected",
                message: "is selected, but not selectable",
            },
        ]);
    });
});
