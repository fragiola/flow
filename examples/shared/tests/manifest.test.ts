// From Splitter (fragiola/splitter, examples/shared/tests/manifest.test.ts), same author and licence.
import { afterEach, describe, expect, it } from "vitest";
import { examplesApp } from "../scripts/examples-lib.ts";
import { buildManifest } from "../scripts/manifest.ts";
import { fakeApp } from "./fake-app.ts";

// The manifest builder serves every framework: the files of each example in its own app, and its
// framework's adapter package. The React manifest's equality with main's is checked by diffing the
// site export (the PR of the Epic that moved it here).

describe("the manifest", () => {
    let remove = () => {};
    afterEach(() => remove());

    it("lists a framework's example files, entry first, and its adapter package", async () => {
        const fake = fakeApp("vue", {
            "basic/index.vue": [
                '<script setup lang="ts">',
                'import { Flow } from "@fragiola/flow-vue";',
                'import { X } from "@lucide/vue";',
                'import { styles } from "./styles";',
                'import Card from "../_kit/card.vue";',
                "</script>",
                "",
            ].join("\n"),
            "basic/styles.ts": "export const styles = {};\n",
            "_kit/card.vue": "<template />\n",
        });
        remove = fake.remove;
        const manifest = await buildManifest(fake.app);
        expect(manifest.examples).toHaveLength(1);
        const [example] = manifest.examples;
        expect(example).toMatchObject({
            id: "basic",
            level: "basics",
            layout: "fill",
            files: ["basic/index.vue", "_kit/card.vue", "basic/styles.ts"],
            packages: ["@fragiola/flow-vue", "@lucide/vue"],
        });
        expect(manifest.files["basic/index.vue"]?.lang).toBe("vue");
    });

    it("lists a layout engine an example imports, by package name", async () => {
        const fake = fakeApp("react", {
            "basic/index.tsx": [
                'import { Flow } from "@fragiola/flow-react";',
                'import ELK from "elkjs/lib/elk.bundled.js";',
                'import dagre from "@dagrejs/dagre";',
                'import { forceSimulation } from "d3-force";',
                "",
            ].join("\n"),
        });
        remove = fake.remove;
        const manifest = await buildManifest(fake.app);
        expect(manifest.examples[0]?.packages).toEqual([
            "@fragiola/flow-react",
            "@dagrejs/dagre",
            "d3-force",
            "elkjs",
        ]);
    });

    it("lists the React package for every React example", async () => {
        const manifest = await buildManifest(examplesApp("react"));
        expect(manifest.examples.length).toBeGreaterThan(0);
        for (const example of manifest.examples) {
            expect(example.packages[0], example.id).toBe(
                "@fragiola/flow-react",
            );
            expect(example.files[0], example.id).toBe(
                `${example.id}/index.tsx`,
            );
        }
    });
});
