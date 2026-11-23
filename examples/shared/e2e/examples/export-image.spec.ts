import { readFile } from "node:fs/promises";
import { type Download, expect, type Page, test } from "@playwright/test";
import { openExample, part } from "../helpers";

// The export-image example: Download SVG saves `flow.svg`, built from the document with the core's
// static geometry (a path per edge, a rectangle and a label per node), in the theme's look read off
// the drawn flow; Download PNG draws that SVG on a canvas and saves `flow.png`. Five nodes,
// Document → Static geometry / Edge paths → SVG <string> → PNG & canvas, five edges.

test.beforeEach(async ({ page }) => {
    await openExample(page, "export-image");
});

const stage = (page: Page) => page.getByTestId("stage");
const button = (page: Page, name: string) =>
    stage(page).getByRole("button", { name, exact: true });

/** Clicks a button and returns the download it starts. */
async function downloadFrom(page: Page, name: string): Promise<Download> {
    const [download] = await Promise.all([
        page.waitForEvent("download"),
        button(page, name).click(),
    ]);
    return download;
}

/** The downloaded file's bytes. */
async function bytesOf(download: Download): Promise<Buffer> {
    const path = await download.path();
    expect(path, "saved").toBeTruthy();
    return readFile(path);
}

test("Download SVG saves an SVG with a path per edge and a shape per node, in the theme's look", async ({
    page,
}) => {
    await expect(part(page, "edge-path")).toHaveCount(5);
    const download = await downloadFrom(page, "Download SVG");
    expect(download.suggestedFilename()).toBe("flow.svg");
    const svg = (await bytesOf(download)).toString("utf8");
    expect(svg).toMatch(/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
    expect(svg).toMatch(/viewBox="[-\d. ]+"/);
    expect(svg.match(/<path [^>]*d="M[^"]+"/g)).toHaveLength(5);
    expect(svg.match(/<rect data-id="[^"]+"/g)).toHaveLength(5);
    expect(svg.match(/<text /g)).toHaveLength(5);
    // the labels are escaped
    expect(svg).toContain(">SVG &lt;string&gt;</text>");
    expect(svg).toContain(">PNG &amp; canvas</text>");
    // the edges' stroke is the page's, resolved at click time
    const stroke = await part(page, "edge-path")
        .first()
        .evaluate((path) => getComputedStyle(path).stroke);
    expect(svg).toContain(`stroke="${stroke}"`);
    await expect(stage(page).getByTestId("message")).toHaveText(
        "Downloaded flow.svg (5 nodes, 5 edges).",
    );
});

test("Download PNG saves a PNG drawn from the SVG", async ({ page }) => {
    const download = await downloadFrom(page, "Download PNG");
    expect(download.suggestedFilename()).toBe("flow.png");
    const png = await bytesOf(download);
    expect(png.length).toBeGreaterThan(100);
    // the PNG signature
    expect([...png.subarray(0, 8)]).toEqual([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    ]);
    await expect(stage(page).getByTestId("message")).toHaveText(
        "Downloaded flow.png (5 nodes, 5 edges).",
    );
});

test("every node, edge and control is named", async ({ page }) => {
    await expect(
        stage(page).getByRole("toolbar", { name: "Export", exact: true }),
    ).toHaveCount(1);
    for (const name of ["Download SVG", "Download PNG"])
        await expect(button(page, name)).toHaveCount(1);
    await expect(stage(page).getByRole("status")).toHaveCount(1);
    const nodes = part(page, "node");
    await expect(nodes).toHaveCount(5);
    for (const element of await nodes.all()) {
        await expect(element).toHaveAccessibleName(/\S/);
    }
    const edges = part(page, "edge");
    await expect(edges).toHaveCount(5);
    for (const element of await edges.all()) {
        await expect(element).toHaveAccessibleName(/\S/);
    }
    await expect(
        stage(page).getByRole("group", { name: "SVG <string>", exact: true }),
    ).toHaveCount(1);
});
