import { expect, type Page, test } from "@playwright/test";
import { edge, node, openExample, part, THEMES } from "../helpers";

// The gradient-styling example: a look of the app's own, every colour a palette's accent. Each
// edge's visible path (its last `edge-path`) is stroked with a `<linearGradient>` of its own, whose
// stops read their palette's accent; a node captures its palette's accent as `--gradient-from`
// and, selected, glows in it. The spec reads the computed `stroke` and checks it names a gradient
// on the page, resolves the stops' colours in every theme, and compares a node's shadow before and
// after it is selected.

const EDGES = [
    "events-parse",
    "parse-validate",
    "validate-report",
    "validate-alerts",
];

/** An edge's visible path: the last of its paths (the first is a wide transparent hit area). */
const visible = (page: Page, edgeId: string) =>
    edge(page, edgeId).locator('[data-flow-part="edge-path"]').last();

/** The id an edge's path takes its stroke from (`null` when it is no `url(#…)`). */
const strokeOf = (page: Page, edgeId: string) =>
    visible(page, edgeId).evaluate(
        (element) =>
            /url\("?#([^")]+)"?\)/.exec(
                getComputedStyle(element).stroke,
            )?.[1] ?? null,
    );

/** A `<linearGradient>`'s stops, by id: their computed colours (`null`: no such gradient). */
const stopsOf = (page: Page, id: string) =>
    page.evaluate((gradientId) => {
        const gradient = document.getElementById(gradientId);
        if (gradient?.tagName.toLowerCase() !== "lineargradient") return null;
        return [...gradient.querySelectorAll("stop")].map(
            (stop) => getComputedStyle(stop).stopColor,
        );
    }, id);

/** A colour that paints: resolved and not fully transparent. */
const paints = (colour: string) =>
    colour !== "" &&
    colour !== "transparent" &&
    !/^rgba\(0, 0, 0, 0\)$/.test(colour) &&
    !/\/ 0\)$/.test(colour);

test("every edge is stroked with a gradient of its own, defined on the page", async ({
    page,
}) => {
    await openExample(page, "gradient-styling");
    await expect(part(page, "edge")).toHaveCount(EDGES.length);
    const ids: string[] = [];
    for (const id of EDGES) {
        await expect.poll(() => strokeOf(page, id), id).not.toBeNull();
        const gradient = (await strokeOf(page, id)) ?? "";
        const stops = await stopsOf(page, gradient);
        expect(stops, id).not.toBeNull();
        expect(stops?.length, id).toBe(2);
        ids.push(gradient);
    }
    // one gradient per edge, each id once on the page
    expect(new Set(ids).size).toBe(EDGES.length);
    const all = await page
        .locator("linearGradient")
        .evaluateAll((gradients) => gradients.map((g) => g.id));
    expect(new Set(all).size).toBe(all.length);
    // the edges' paths cast a soft shadow
    const filter = await visible(page, "events-parse").evaluate(
        (element) => getComputedStyle(element).filter,
    );
    expect(filter).toContain("drop-shadow");
});

for (const { name } of THEMES) {
    test(`the gradients' colours resolve in the ${name} theme`, async ({
        page,
    }) => {
        await openExample(page, "gradient-styling", { theme: name });
        for (const id of EDGES) {
            await expect.poll(() => strokeOf(page, id), id).not.toBeNull();
            const stops =
                (await stopsOf(page, (await strokeOf(page, id)) ?? "")) ?? [];
            expect(stops.length, id).toBe(2);
            for (const colour of stops) {
                expect(paints(colour), `${id}: ${colour}`).toBe(true);
            }
            // two palettes, two colours
            expect(stops[0], id).not.toBe(stops[1]);
        }
        for (const element of await part(page, "node").all()) {
            const from = await element.evaluate((el) =>
                getComputedStyle(el).getPropertyValue("--gradient-from").trim(),
            );
            expect(from).not.toBe("");
        }
    });
}

test("a selected node glows, and stops when another is selected", async ({
    page,
}) => {
    await openExample(page, "gradient-styling");
    const shadow = (id: string) =>
        node(page, id).evaluate((el) => getComputedStyle(el).boxShadow);
    const resting = await shadow("parse");
    await node(page, "parse").click();
    await expect(node(page, "parse")).toHaveAttribute("data-selected", "");
    await expect.poll(() => shadow("parse")).not.toBe(resting);
    expect(await shadow("parse")).not.toBe("none");
    await node(page, "report").click();
    await expect(node(page, "report")).toHaveAttribute("data-selected", "");
    await expect(node(page, "parse")).not.toHaveAttribute("data-selected");
    await expect.poll(() => shadow("parse")).toBe(resting);
});

test("every node and edge is named, the nodes by their kind", async ({
    page,
}) => {
    await openExample(page, "gradient-styling");
    const nodes = part(page, "node");
    await expect(nodes).toHaveCount(5);
    for (const element of await nodes.all()) {
        await expect(element).toHaveAccessibleName(/\S/);
    }
    for (const element of await part(page, "edge").all()) {
        await expect(element).toHaveAccessibleName(/\S/);
    }
    const stage = page.getByTestId("stage");
    await expect(
        stage.getByRole("group", {
            name: "Parse, a transform step: JSON lines to rows",
            exact: true,
        }),
    ).toHaveCount(1);
    await expect(
        stage.getByRole("group", { name: "Validate to Alerts", exact: true }),
    ).toHaveCount(1);
    await expect(
        stage.getByRole("group", { name: "Gradient styling", exact: true }),
    ).toHaveCount(1);
});
