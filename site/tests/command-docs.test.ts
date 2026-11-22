import { execFileSync, spawnSync } from "node:child_process";
import {
    copyFileSync,
    existsSync,
    mkdtempSync,
    readFileSync,
    rmSync,
    writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// `pnpm check` runs `check:commands`: packages/core/scripts/generate-command-docs.ts --check fails
// when site/docs/api/commands.mdx drifts from the command registry. These run it on copies.

const root = join(import.meta.dirname, "..", "..");
const script = join(root, "packages/core/scripts/generate-command-docs.ts");
const page = join(root, "site/docs/api/commands.mdx");
let dir = "";

function check(out: string) {
    return spawnSync("node", [script, "--check", `--out=${out}`], {
        encoding: "utf8",
    });
}

beforeAll(() => {
    if (!existsSync(join(root, "packages/core/dist/index.js"))) {
        execFileSync("pnpm", ["--filter", "@fragiola/flow", "build"], {
            cwd: root,
            stdio: "ignore",
        });
    }
    dir = mkdtempSync(join(tmpdir(), "flow-commands-"));
});

afterAll(() => {
    rmSync(dir, { recursive: true, force: true });
});

describe("the command docs drift check", () => {
    it("passes on the committed page", () => {
        const copy = join(dir, "same.mdx");
        copyFileSync(page, copy);
        expect(check(copy).status).toBe(0);
    });

    it("fails on a page that drifted, and on a missing one", () => {
        const drifted = join(dir, "drifted.mdx");
        writeFileSync(
            drifted,
            readFileSync(page, "utf8").replace("node.move", "node.fly"),
        );
        const result = check(drifted);
        expect(result.status).toBe(1);
        expect(result.stderr).toContain("is out of date");
        expect(check(join(dir, "missing.mdx")).status).toBe(1);
    });

    it("documents every command, each with the feature it comes with", () => {
        const text = readFileSync(page, "utf8");
        for (const name of [
            "node.add",
            "node.remove",
            "node.move",
            "node.resize",
            "node.set-data",
            "node.set-flags",
            "node.set-z-index",
            "node.set-parent",
            "edge.add",
            "edge.remove",
            "edge.reconnect",
            "edge.set-data",
            "edge.set-flags",
            "edge.set-z-index",
            "selection.set",
            "selection.clear",
            "selection.remove",
            "batch",
        ]) {
            expect(text).toContain(`### \`${name}\``);
        }
        expect(text).toContain(
            "install `reconnection()` from `@fragiola/flow/reconnection`",
        );
    });
});
