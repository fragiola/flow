import { expect, type Page, test } from "@playwright/test";
import { edge, openExample, part } from "../helpers";

// The animating-edges example: the package animates nothing, so the example puts the motion in
// its edges: a dot (`data-testid="traveller"`) travels along one edge's path (`animateMotion`),
// dashes flow along another (an `animate` of the path's `stroke-dashoffset`), and the third pulses
// once when a value is sent (`data-pulsing`, cleared on `animationend`, when the counter receives
// it). Under reduced motion the first two say so (`data-reduced-motion`) and hold still.

test.beforeEach(async ({ page }) => {
    await openExample(page, "animating-edges");
});

const TRAVEL = "ingest-process";
const DASH = "process-store";
const PULSE = "sender-counter";

/** The travelling dot, inside its edge. */
const traveller = (page: Page) => edge(page, TRAVEL).getByTestId("traveller");

/** The `animate` running the dashes, on the dashed edge's path. */
const dashes = (page: Page) =>
    edge(page, DASH).locator('[data-flow-part="edge-path"] > animate');

/** Where the dot is on screen now. */
const where = (page: Page) =>
    traveller(page).evaluate((element) => {
        const box = element.getBoundingClientRect();
        return `${Math.round(box.x)},${Math.round(box.y)}`;
    });

test("a dot travels along an edge's path, and dashes flow along another", async ({
    page,
}) => {
    await expect(part(page, "edge")).toHaveCount(3);
    await expect(traveller(page)).toHaveCount(1);
    await expect(traveller(page).locator("animateMotion")).toHaveAttribute(
        "repeatCount",
        "indefinite",
    );
    // the dot's motion follows the edge's own path
    const d = await edge(page, TRAVEL)
        .locator('[data-flow-part="edge-path"]')
        .last()
        .getAttribute("d");
    await expect(traveller(page).locator("animateMotion")).toHaveAttribute(
        "path",
        d ?? "",
    );
    // and it moves
    const start = await where(page);
    await expect.poll(() => where(page)).not.toBe(start);
    await expect(dashes(page)).toHaveAttribute(
        "attributeName",
        "stroke-dashoffset",
    );
    for (const id of [TRAVEL, DASH]) {
        await expect(edge(page, id)).not.toHaveAttribute("data-reduced-motion");
    }
});

test("under reduced motion the dot and the dashes stop, and start again after", async ({
    page,
}) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    for (const id of [TRAVEL, DASH]) {
        await expect(edge(page, id)).toHaveAttribute("data-reduced-motion", "");
    }
    await expect(traveller(page)).toHaveCount(0);
    await expect(dashes(page)).toHaveCount(0);
    await expect(
        page.getByTestId("stage").getByRole("group", {
            name: "Ingest to Process: a dot travels along it, still for reduced motion",
            exact: true,
        }),
    ).toHaveCount(1);
    // the pulse is not motion along the edge: it still runs, once
    await page.getByRole("button", { name: "Send a value" }).click();
    await expect(page.getByTestId("received")).toHaveText("1");
    await expect(edge(page, PULSE)).not.toHaveAttribute("data-pulsing");

    await page.emulateMedia({ reducedMotion: "no-preference" });
    await expect(edge(page, TRAVEL)).not.toHaveAttribute("data-reduced-motion");
    await expect(traveller(page)).toHaveCount(1);
    await expect(dashes(page)).toHaveCount(1);
});

test("a reduced-motion user never sees the dot", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.reload();
    await expect(part(page, "edge")).toHaveCount(3);
    await expect(edge(page, TRAVEL)).toHaveAttribute("data-reduced-motion", "");
    await expect(traveller(page)).toHaveCount(0);
    await expect(dashes(page)).toHaveCount(0);
});

test("sending a value pulses its edge once, then the counter receives it", async ({
    page,
}) => {
    const send = page.getByRole("button", { name: "Send a value" });
    const received = page.getByTestId("received");
    await expect(received).toHaveText("0");
    await expect(edge(page, PULSE)).not.toHaveAttribute("data-pulsing");

    await send.click();
    await expect(edge(page, PULSE)).toHaveAttribute("data-pulsing", "");
    // one pulse, not a loop
    expect(
        await edge(page, PULSE).evaluate(
            (element) => getComputedStyle(element).animationIterationCount,
        ),
    ).toBe("1");
    await expect(send).toBeDisabled();
    // the pulse ended: the mark is gone, the value arrived, and nothing runs again
    await expect(edge(page, PULSE)).not.toHaveAttribute("data-pulsing");
    await expect(received).toHaveText("1");
    await expect(send).toBeEnabled();
    expect(
        await edge(page, PULSE).evaluate(
            (element) => getComputedStyle(element).animationName,
        ),
    ).toBe("none");

    await send.click();
    await expect(received).toHaveText("2");
    await expect(edge(page, PULSE)).not.toHaveAttribute("data-pulsing");
});

test("deleting the pulsing edge drops the value and frees Send", async ({
    page,
}) => {
    const send = page.getByRole("button", { name: "Send a value" });
    await send.click();
    await expect(edge(page, PULSE)).toHaveAttribute("data-pulsing", "");
    await expect(send).toBeDisabled();
    // selected and deleted from the keyboard while the value is on its way
    await edge(page, PULSE).focus();
    await page.keyboard.press("Enter");
    await page.keyboard.press("Delete");
    await expect(edge(page, PULSE)).toHaveCount(0);
    await expect(send).toBeEnabled();
    await expect(page.getByTestId("received")).toHaveText("0");
});

test("every node, edge and control is named", async ({ page }) => {
    const nodes = part(page, "node");
    await expect(nodes).toHaveCount(5);
    for (const element of await nodes.all()) {
        await expect(element).toHaveAccessibleName(/\S/);
    }
    for (const element of await part(page, "edge").all()) {
        await expect(element).toHaveAccessibleName(/\S/);
    }
    const stage = page.getByTestId("stage");
    for (const name of [
        "Ingest to Process: a dot travels along it",
        "Process to Store: dashes flow along it",
        "Sender to Counter: pulses once when a value passes",
    ]) {
        await expect(
            stage.getByRole("group", { name, exact: true }),
        ).toHaveCount(1);
    }
    await expect(
        stage.getByRole("button", { name: "Send a value" }),
    ).toBeVisible();
    await expect(
        stage.getByRole("status", { name: "Values received" }),
    ).toHaveText("0");
});
