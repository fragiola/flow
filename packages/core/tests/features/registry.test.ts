import { describe, expect, it, vi } from "vitest";
import { connection } from "../../src/connection/connection";
import { drag } from "../../src/drag/drag";
import { FEATURE_KEYS, ownerOf } from "../../src/features/keys";
import { composeFeatures, featureEngine } from "../../src/features/registry";
import type { AnyFlowFeature, FeatureModel } from "../../src/features/types";
import { keyboard } from "../../src/keyboard/keyboard";
import { minimap } from "../../src/minimap/minimap";
import { createFlowModel } from "../../src/model/create-flow-model";
import { reconnection } from "../../src/reconnection/reconnection";
import { resize } from "../../src/resize/resize";
import { selection } from "../../src/selection/selection";
import { subflows } from "../../src/subflows/subflows";

const ALL = () => [
    selection(),
    subflows(),
    drag(),
    resize(),
    connection(),
    reconnection(),
    keyboard(),
    minimap(),
];

describe("the feature registry", () => {
    it("checks requirements at creation, naming both features", () => {
        expect(() =>
            createFlowModel(undefined, { features: [reconnection()] }),
        ).toThrow(
            'feature "reconnection" requires feature "connection": install it too',
        );
        // the list's order is free
        expect(() =>
            createFlowModel(undefined, {
                features: [reconnection(), connection()],
            }),
        ).not.toThrow();
    });

    it("refuses a feature installed twice", () => {
        expect(() => composeFeatures([drag(), drag()])).toThrow(
            'feature "drag" is installed twice: install it once',
        );
    });

    it("refuses two features adding the same key", () => {
        const twin = {
            ...minimap(),
            name: "keyboard",
            get: { "selected-nodes": () => [] },
        };
        const other = { ...minimap(), get: { "selected-nodes": () => [] } };
        expect(() =>
            composeFeatures([twin as AnyFlowFeature, other as AnyFlowFeature]),
        ).toThrow(
            'feature "minimap" adds the get key "selected-nodes", which another feature adds',
        );
    });

    it("fixes the list at creation: the app's array changing later changes nothing", () => {
        const features: AnyFlowFeature[] = [selection()];
        const composed = composeFeatures(features);
        features.push(subflows());
        expect(composed.list.map((feature) => feature.name)).toEqual([
            "selection",
        ]);
    });

    it("names the feature that owns a key, a command or a field", () => {
        expect(ownerOf("commands", "selection.set")).toBe("selection");
        expect(ownerOf("commands", "edge.reconnect")).toBe("reconnection");
        expect(ownerOf("get", "node-parent-by")).toBe("subflows");
        expect(ownerOf("nodeFields", "selected")).toBe("selection");
        expect(ownerOf("edgeFields", "selected")).toBe("selection");
        expect(ownerOf("commands", "node.add")).toBeUndefined();
        const bare = composeFeatures([]);
        expect(bare.missing("commands", "node.set-parent")).toBe("subflows");
        expect(
            composeFeatures([subflows()]).missing(
                "commands",
                "node.set-parent",
            ),
        ).toBeUndefined();
    });

    it("every feature's commands and keys are the ones FEATURE_KEYS names", () => {
        for (const feature of ALL()) {
            const keys = FEATURE_KEYS[feature.name];
            expect(
                (feature.commands ?? []).map((command) => command.name).sort(),
            ).toEqual([...keys.commands].sort());
            expect(Object.keys(feature.get ?? {}).sort()).toEqual(
                [...keys.get].sort(),
            );
            expect(Object.keys(feature.is ?? {}).sort()).toEqual(
                [...keys.is].sort(),
            );
        }
        expect(Object.keys(FEATURE_KEYS).sort()).toEqual(
            ALL()
                .map((feature) => feature.name)
                .sort(),
        );
    });

    it("lists every feature's commands with the feature they come with", () => {
        const model = createFlowModel(undefined, { features: ALL() });
        const commands = model.get("commands");
        expect(commands).toHaveLength(16);
        expect(
            commands.find((info) => info.name === "selection.set")?.feature,
        ).toBe("selection");
        expect(
            commands.find((info) => info.name === "node.add")?.feature,
        ).toBeUndefined();
    });

    it("composes the features' engine sides: keys merged, hooks in install order", () => {
        const pressed: string[] = [];
        const withEngine = (
            name: "drag" | "connection",
            takes: boolean,
        ): AnyFlowFeature => ({
            ...(name === "drag" ? drag() : connection()),
            engine: (host) => ({
                get: {
                    [`${name}-key`]: () =>
                        host.shared("session", () => ({ name })),
                },
                pointerdown: () => {
                    pressed.push(name);
                    return takes;
                },
                destroy: vi.fn(),
            }),
        });
        const composed = composeFeatures([
            withEngine("drag", false),
            withEngine("connection", true),
        ]);
        const slots = new Map<string, unknown>();
        const engine = featureEngine(composed, {
            model: {} as FeatureModel,
            shared: <V>(key: string, create: () => V) => {
                if (!slots.has(key)) slots.set(key, create());
                return slots.get(key) as V;
            },
        });
        expect([...engine.get.keys()]).toEqual(["drag-key", "connection-key"]);
        expect(engine.get.get("connection-key")?.(undefined)).toEqual({
            name: "connection",
        });
        expect(engine.get.get("drag-key")?.(undefined)).toEqual({
            name: "connection",
        });
        expect(engine.pointerdown({} as PointerEvent)).toBe(true);
        expect(pressed).toEqual(["drag", "connection"]);
        expect(engine.keydown({} as KeyboardEvent)).toBe(false);
        engine.destroy();
        for (const part of engine.list)
            expect(part.destroy).toHaveBeenCalledOnce();
    });
});

describe("the feature factories", () => {
    it("resolve their options with defaults, frozen", () => {
        expect(drag().options).toEqual({ snapGrid: undefined, threshold: 1 });
        expect(drag({ snapGrid: [10, 10] }).options.snapGrid).toEqual([10, 10]);
        expect(resize({ minWidth: 40 }).options).toEqual({
            minWidth: 40,
            minHeight: 10,
            maxWidth: Number.POSITIVE_INFINITY,
            maxHeight: Number.POSITIVE_INFINITY,
            keepAspectRatio: false,
        });
        expect(connection().options).toEqual({ radius: 20, mode: "strict" });
        expect(reconnection().options).toEqual({ radius: 10 });
        expect(reconnection().requires).toEqual(["connection"]);
        expect(keyboard({ step: 1 }).options).toEqual({
            step: 1,
            fastStep: 20,
        });
        expect(minimap().options).toEqual({ pannable: true, zoomable: true });
        expect(selection().options).toEqual({
            boxMode: "full",
            multiple: true,
        });
        expect(subflows().options).toEqual({});
        for (const feature of ALL()) {
            expect(Object.isFrozen(feature)).toBe(true);
            expect(Object.isFrozen(feature.options)).toBe(true);
        }
    });
});
