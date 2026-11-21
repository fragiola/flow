import { describe, expect, it } from "vitest";
import { anyUses, codeOnly } from "../../scripts/check-dts.ts";

// `pnpm build` runs scripts/check-dts.ts over the packages' emitted declarations.
describe("the built declarations check", () => {
    it("finds `any` in a type", () => {
        expect(anyUses("export declare function f(x: any): void;")).toEqual([
            "export declare function f(x: any): void;",
        ]);
        expect(anyUses("type A = Record<string, any>[];")).toHaveLength(1);
    });

    it("ignores `any` in comments, strings and longer words", () => {
        expect(
            anyUses(
                '/** any comment */\n// any\nexport type Company = "any";\ntype Anything = 1;',
            ),
        ).toEqual([]);
        expect(codeOnly('type A = "any"; // any')).not.toMatch(/\bany\b/);
    });

    it("ignores the Angular compiler's metadata on a compiled class, and only it", () => {
        expect(
            anyUses(
                [
                    "declare class DockableTab<T> {",
                    "    static ɵfac: i0.ɵɵFactoryDeclaration<DockableTab<any>, never>;",
                    '    static ɵdir: i0.ɵɵDirectiveDeclaration<DockableTab<any>, "[dockableTab]", never, {}, {}, never, never, true, never>;',
                    "    readonly node: any;",
                    "}",
                ].join("\n"),
            ),
        ).toEqual(["readonly node: any;"]);
    });

    it("ignores svelte2tsx's bindings member on a generic Svelte component, and only it", () => {
        expect(
            anyUses(
                [
                    "interface $$IsomorphicComponent {",
                    "    <T extends FlowTypes = AnyTypes>(internal: unknown, props: Props<T>): {};",
                    "    z_$$bindings?: ReturnType<__sveltets_Render<any, any>['bindings']>;",
                    "    other?: ReturnType<__sveltets_Render<any>['bindings']>;",
                    "}",
                ].join("\n"),
            ),
        ).toEqual(['other?: ReturnType<__sveltets_Render<any>[""]>;']);
    });
});
