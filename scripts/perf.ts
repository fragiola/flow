// The large-flow measurement (Epic #61): the `stress-test` example of an embed (React's by
// default, `--framework vue` for Vue's, #51), in a production build, driven by Playwright in Chromium. For each size it opens a fresh flow (the
// time until its first frame, and how many nodes mounted on the way), then pans, zooms (out, then
// back in) and drags a node with 120 pointer steps at 60 Hz, timing every frame
// (requestAnimationFrame intervals), and prints the median / p95 / max frame time per size and
// gesture, each the median of the runs. Not run in CI: frame times are the machine's.
//
//   pnpm perf [--framework react|vue] [--sizes 1000,10000,20000] [--runs 3] [--steps 120]
//             [--no-build] [--dist <dir>] [--profile <dir>] [--headed] [--verbose] [--json <file>]
//
// `--no-build` reuses the packages' last `dist` (the embed is built again); `--dist` serves an
// embed built before (`EMBED_BASE=/`), building nothing; `--profile` writes a
// CPU profile of each size's first open and of its gestures into <dir>. The embed is served from a
// temporary directory by `examples/shared/e2e/serve.ts`, in a process group of its own that is
// killed on exit.
import { type ChildProcess, execFileSync, spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseArgs } from "node:util";
import type * as Playwright from "@playwright/test";

const root = join(import.meta.dirname, "..");

/** The embeds `--framework` measures, with the adapter package each one is built against. */
const FRAMEWORKS = {
    react: { name: "React", adapter: "@fragiola/flow-react" },
    vue: { name: "Vue", adapter: "@fragiola/flow-vue" },
} as const;

const { values: args } = parseArgs({
    options: {
        framework: { type: "string", default: "react" },
        sizes: { type: "string", default: "1000,10000,20000" },
        runs: { type: "string", default: "3" },
        steps: { type: "string", default: "120" },
        "no-build": { type: "boolean", default: false },
        profile: { type: "string" },
        headed: { type: "boolean", default: false },
        verbose: { type: "boolean", default: false },
        json: { type: "string" },
        dist: { type: "string" },
    },
});
/** With `--verbose`, each step as it starts (on stderr). */
const verbose = (step: string) => {
    if (args.verbose) process.stderr.write(`  … ${step}\n`);
};
if (!Object.hasOwn(FRAMEWORKS, args.framework)) {
    throw new Error(
        `--framework must be one of ${Object.keys(FRAMEWORKS).join(", ")} (got ${args.framework})`,
    );
}
const framework = FRAMEWORKS[args.framework as keyof typeof FRAMEWORKS];
const app = join(root, "examples", args.framework);
const SIZES = args.sizes.split(",").map(Number);
const RUNS = Number(args.runs);
const STEPS = Number(args.steps);

// Playwright is the examples app's dependency (the version CI's image pins)
const { chromium } = createRequire(join(app, "package.json"))(
    "@playwright/test",
) as typeof Playwright;

// ---------------------------------------------------------------------------------------------
// the build and its server
// ---------------------------------------------------------------------------------------------

const scratch = mkdtempSync(join(tmpdir(), "flow-perf-"));
// `--dist`: an embed built before (served as it is, nothing built)
const dist = args.dist ?? join(scratch, "dist");
let server: ChildProcess | undefined;

/** Stops the server (its whole process group) and removes the scratch directory. */
function cleanUp(): void {
    if (server?.pid !== undefined && server.exitCode === null) {
        try {
            process.kill(-server.pid, "SIGTERM");
        } catch {
            // already gone
        }
    }
    server = undefined;
    rmSync(scratch, { recursive: true, force: true });
}
process.on("exit", cleanUp);
for (const signal of ["SIGINT", "SIGTERM"] as const) {
    process.on(signal, () => {
        cleanUp();
        process.exit(130);
    });
}

/** Runs a build step, quietly: its output is shown only when it fails. */
function run(command: string, commandArgs: string[], cwd: string, env = {}) {
    try {
        execFileSync(command, commandArgs, {
            cwd,
            stdio: "pipe",
            env: { ...process.env, ...env },
        });
    } catch (error) {
        const { stdout, stderr } = error as {
            stdout?: Buffer;
            stderr?: Buffer;
        };
        process.stderr.write(`${stdout ?? ""}${stderr ?? ""}`);
        throw error;
    }
}

if (!args.dist) {
    if (!args["no-build"]) {
        console.log(
            `building the core, the ${framework.name} package and the ${framework.name} embed…`,
        );
        run(
            "pnpm",
            [
                "--filter",
                "@fragiola/flow",
                "--filter",
                framework.adapter,
                "build",
            ],
            root,
        );
    }
    run("pnpm", ["run", "build"], app, {
        EMBED_BASE: "/",
        EMBED_OUT_DIR: dist,
    });
}

/** A free local port. */
function freePort(): Promise<number> {
    return new Promise((resolve, reject) => {
        const probe = createServer();
        probe.unref();
        probe.on("error", reject);
        probe.listen(0, () => {
            const address = probe.address();
            probe.close(() =>
                typeof address === "object" && address
                    ? resolve(address.port)
                    : reject(new Error("no port")),
            );
        });
    });
}

const port = await freePort();
server = spawn(
    process.execPath,
    [join(root, "examples/shared/e2e/serve.ts"), String(port), dist, "/"],
    { cwd: app, detached: true, stdio: "ignore" },
);
// it never keeps this process alive: the exit handler stops it
server.unref();
const base = `http://localhost:${port}/`;
for (let tries = 0; ; tries++) {
    const up = await fetch(base).then(
        (response) => response.ok,
        () => false,
    );
    if (up) break;
    if (tries > 100)
        throw new Error(`the embed's server did not start on ${base}`);
    await new Promise((resolve) => setTimeout(resolve, 100));
}

// ---------------------------------------------------------------------------------------------
// statistics
// ---------------------------------------------------------------------------------------------

interface Stats {
    readonly median: number;
    readonly p95: number;
    readonly max: number;
    readonly frames: number;
}

/**
 * Chromium runs a late frame's rAF callbacks back to back (a ~1 ms interval after a long one):
 * the pair is one frame on screen, so an interval under 6 ms joins the one before it.
 */
function coalesce(intervals: readonly number[]): number[] {
    const frames: number[] = [];
    for (const interval of intervals) {
        if (interval < 6 && frames.length > 0) {
            frames[frames.length - 1] = (frames.at(-1) ?? 0) + interval;
        } else frames.push(interval);
    }
    return frames;
}

/** The value at a share of the sorted values (nearest rank). */
function quantile(sorted: readonly number[], share: number): number {
    const index = Math.min(
        sorted.length - 1,
        Math.floor(share * (sorted.length - 1) + 0.5),
    );
    return sorted[index] ?? Number.NaN;
}

function statsOf(intervals: readonly number[]): Stats {
    const sorted = coalesce(intervals).sort((a, b) => a - b);
    return {
        median: quantile(sorted, 0.5),
        p95: quantile(sorted, 0.95),
        max: sorted.at(-1) ?? Number.NaN,
        frames: sorted.length,
    };
}

const median = (values: readonly number[]) =>
    quantile(
        [...values].sort((a, b) => a - b),
        0.5,
    );

// ---------------------------------------------------------------------------------------------
// the page and its gestures
// ---------------------------------------------------------------------------------------------

const browser = await chromium.launch({
    headless: !args.headed,
    // the full Chromium in its new headless mode, not the headless shell: real frame scheduling
    channel: "chromium",
    args: [
        "--disable-background-timer-throttling",
        "--disable-renderer-backgrounding",
        "--disable-backgrounding-occluded-windows",
    ],
});
const version = browser.version();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
page.on("pageerror", (error) => console.error("page error:", error));
await page.goto(`${base}?id=stress-test`);
const readout = page.getByTestId("readout");
await page.waitForSelector('[data-testid="readout"]:not([data-render-ms="–"])');

interface Sampler {
    on: boolean;
    frames: number[];
    mounted: number;
}
type SampledWindow = Window & { __perf: Sampler };

// a sampler of rAF intervals, and a count of the node elements inserted into the page
await page.evaluate(() => {
    const sampler: Sampler = { on: false, frames: [], mounted: 0 };
    (window as unknown as SampledWindow).__perf = sampler;
    let last: number | undefined;
    requestAnimationFrame(function tick() {
        // performance.now(), not the frame's timestamp: headless frames are stamped on a beat
        const now = performance.now();
        if (sampler.on) {
            if (last !== undefined) sampler.frames.push(now - last);
            last = now;
        } else last = undefined;
        requestAnimationFrame(tick);
    });
    // every node element inserted, counted as it is inserted (React and Vue build a subtree
    // before they attach it, and may remove a node before an observer would see it)
    const proto = Node.prototype;
    const counted = <A extends unknown[]>(
        insert: (this: Node, child: Node, ...rest: A) => Node,
    ) =>
        function (this: Node, child: Node, ...rest: A) {
            if (
                child instanceof Element &&
                child.getAttribute("data-flow-part") === "node"
            ) {
                sampler.mounted++;
            }
            return insert.call(this, child, ...rest);
        };
    proto.appendChild = counted(proto.appendChild) as typeof proto.appendChild;
    proto.insertBefore = counted(
        proto.insertBefore,
    ) as typeof proto.insertBefore;
});

const frame = () =>
    page.evaluate(
        () => new Promise<void>((done) => requestAnimationFrame(() => done())),
    );

let tick = 0;
/** Waits for the next step of a 60 Hz pointer. */
async function step(): Promise<void> {
    const next = tick + 1000 / 60;
    const now = performance.now();
    if (next > now) await new Promise((done) => setTimeout(done, next - now));
    tick = Math.max(next, performance.now() - 1000 / 60);
}

async function sampled(
    name: string,
    gesture: () => Promise<void>,
): Promise<Stats> {
    verbose(name);
    await frame();
    await frame();
    await page.evaluate(() => {
        const sampler = (window as unknown as SampledWindow).__perf;
        sampler.frames = [];
        sampler.on = true;
    });
    tick = performance.now();
    await gesture();
    const frames = await page.evaluate(() => {
        const sampler = (window as unknown as SampledWindow).__perf;
        sampler.on = false;
        return sampler.frames;
    });
    return statsOf(frames);
}

/** A point of the pane with no node or edge under it, away from the readout. */
async function emptyPoint(): Promise<{ x: number; y: number }> {
    const point = await page.evaluate(() => {
        const root = document
            .querySelector('[data-flow-part="root"]')
            ?.getBoundingClientRect();
        const panel = document
            .querySelector('[data-testid="readout"]')
            ?.parentElement?.getBoundingClientRect();
        if (!root || !panel) return null;
        for (let y = root.top + 300; y < root.bottom - 40; y += 7) {
            for (let x = root.left + 300; x < root.right - 300; x += 7) {
                const inPanel =
                    x > panel.left &&
                    x < panel.right &&
                    y > panel.top &&
                    y < panel.bottom;
                if (inPanel) continue;
                const element = document.elementFromPoint(x, y);
                if (
                    element &&
                    !element.closest(
                        '[data-flow-part="node"],[data-flow-part="edge"]',
                    ) &&
                    element.closest('[data-flow-part="root"]')
                ) {
                    return { x, y };
                }
            }
        }
        return null;
    });
    if (!point) throw new Error("no empty point on the pane");
    return point;
}

async function pan(): Promise<void> {
    const { x, y } = await emptyPoint();
    await page.mouse.move(x, y);
    await page.mouse.down();
    for (let i = 1; i <= STEPS; i++) {
        // left and up, then back
        const k = i <= STEPS / 2 ? i : STEPS - i;
        await page.mouse.move(x - k * 8, y - k * 5);
        await step();
    }
    await page.mouse.up();
}

async function zoom(): Promise<void> {
    const { x, y } = await emptyPoint();
    await page.mouse.move(x, y);
    for (let i = 1; i <= STEPS; i++) {
        // out, then back in
        await page.mouse.wheel(0, i <= STEPS / 2 ? 40 : -40);
        await step();
    }
}

async function drag(): Promise<void> {
    const start = await page.evaluate(() => {
        const root = document
            .querySelector('[data-flow-part="root"]')
            ?.getBoundingClientRect();
        if (!root) return null;
        for (const node of document.querySelectorAll(
            '[data-flow-part="node"]',
        )) {
            const box = node.getBoundingClientRect();
            if (
                box.top > root.top + 250 &&
                box.left > root.left + 200 &&
                box.right < root.right - 300 &&
                box.bottom < root.bottom - 150
            ) {
                return {
                    x: box.left + box.width / 2,
                    y: box.top + box.height / 2,
                };
            }
        }
        return null;
    });
    if (!start) throw new Error("no node to drag in the middle of the view");
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    for (let i = 1; i <= STEPS; i++) {
        const k = i <= STEPS / 2 ? i : STEPS - i + 10;
        await page.mouse.move(start.x + k * 4, start.y + k * 2);
        await step();
    }
    await page.mouse.up();
    await frame();
}

interface Open {
    /** from the size's switch to the frame after the engine's `init` (the readout's) */
    readonly ms: number;
    /** node elements added to the page meanwhile */
    readonly mounted: number;
    /** node elements in the page once drawn */
    readonly dom: number;
}

/** Switches the example to a size (a new flow) and waits for its first frame. */
async function open(size: number): Promise<Open> {
    verbose(`open ${size}`);
    await page.evaluate(() => {
        (window as unknown as SampledWindow).__perf.mounted = 0;
    });
    await page.getByLabel("Size").selectOption(String(size));
    await page.waitForFunction(
        (wanted) => {
            const data = (
                document.querySelector('[data-testid="readout"]') as HTMLElement
            ).dataset;
            return data.size === String(wanted) && data.renderMs !== "–";
        },
        size,
        { timeout: 120_000 },
    );
    for (let i = 0; i < 5; i++) await frame();
    return {
        ms: Number(await readout.getAttribute("data-render-ms")),
        mounted: await page.evaluate(
            () => (window as unknown as SampledWindow).__perf.mounted,
        ),
        dom: await page.locator('[data-flow-part="node"]').count(),
    };
}

// ---------------------------------------------------------------------------------------------
// the runs
// ---------------------------------------------------------------------------------------------

const cdp = args.profile ? await page.context().newCDPSession(page) : undefined;
if (cdp && args.profile) {
    mkdirSync(args.profile, { recursive: true });
    await cdp.send("Profiler.enable");
    await cdp.send("Profiler.setSamplingInterval", { interval: 200 });
}

async function profiled<V>(
    name: string,
    first: boolean,
    work: () => Promise<V>,
): Promise<V> {
    if (!cdp || !args.profile || !first) return work();
    await cdp.send("Profiler.start");
    const value = await work();
    const { profile } = await cdp.send("Profiler.stop");
    writeFileSync(
        join(args.profile, `${name}.cpuprofile`),
        JSON.stringify(profile),
    );
    return value;
}

const GESTURES = { pan, zoom, drag } as const;
type Gesture = keyof typeof GESTURES;

interface Run {
    readonly size: number;
    readonly open: Open;
    readonly gestures: Record<Gesture, Stats>;
}

const runs: Run[] = [];
console.log(
    `Chromium ${version}, 1280 × 800, ${STEPS} steps at 60 Hz, ${RUNS} run(s) per size`,
);
for (const size of SIZES) {
    for (let index = 0; index < RUNS; index++) {
        // a fresh flow per run: away to another size first when this one is shown
        if ((await readout.getAttribute("data-size")) === String(size)) {
            await open(size === 1000 ? 5000 : 1000);
        }
        const first = index === 0;
        const opened = await profiled(`open-${size}`, first, () => open(size));
        const gestures = await profiled(
            `gestures-${size}`,
            first,
            async () => ({
                pan: await sampled("pan", pan),
                zoom: await sampled("zoom", zoom),
                drag: await sampled("drag", drag),
            }),
        );
        runs.push({ size, open: opened, gestures });
        const cell = (stats: Stats) =>
            `${stats.median.toFixed(1)}/${stats.p95.toFixed(1)}/${stats.max.toFixed(1)}`;
        console.log(
            `  ${size} run ${index + 1}: open ${opened.ms} ms (${opened.mounted} nodes mounted, ${opened.dom} in the DOM) | pan ${cell(gestures.pan)} | zoom ${cell(gestures.zoom)} | drag ${cell(gestures.drag)}`,
        );
    }
}
await browser.close();

// ---------------------------------------------------------------------------------------------
// the table
// ---------------------------------------------------------------------------------------------

const ms = (value: number) => value.toFixed(1);
const rows = SIZES.map((size) => {
    const own = runs.filter((run) => run.size === size);
    const of = (gesture: Gesture, key: keyof Stats) =>
        median(own.map((run) => run.gestures[gesture][key]));
    return [
        size.toLocaleString("en-US"),
        `${ms(median(own.map((run) => run.open.ms)))} (${Math.max(...own.map((run) => run.open.mounted))})`,
        ...(Object.keys(GESTURES) as Gesture[]).map(
            (gesture) =>
                `${ms(of(gesture, "median"))} / ${ms(of(gesture, "p95"))} / ${ms(of(gesture, "max"))}`,
        ),
    ];
});
const header = [
    "nodes",
    "open ms (mounted)",
    "pan median / p95 / max",
    "zoom median / p95 / max",
    "drag median / p95 / max",
];
const widths = header.map((title, i) =>
    Math.max(title.length, ...rows.map((row) => (row[i] ?? "").length)),
);
const line = (cells: readonly string[]) =>
    `| ${cells.map((cell, i) => cell.padEnd(widths[i] ?? 0)).join(" | ")} |`;
console.log("");
console.log(`${framework.name}: frame times in ms, the median of the runs:`);
console.log(line(header));
console.log(`|${widths.map((width) => "-".repeat(width + 2)).join("|")}|`);
for (const row of rows) console.log(line(row));
if (args.json) {
    writeFileSync(
        args.json,
        JSON.stringify(
            {
                framework: args.framework,
                chromium: version,
                steps: STEPS,
                runs,
            },
            null,
            4,
        ),
    );
}
// the exit handler stops the server and removes the build
process.exit(0);
