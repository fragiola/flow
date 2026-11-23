import { expect, type Page, test } from "@playwright/test";
import { handle, node, openExample, part } from "../helpers";
import { boxIn, nodeBoxes } from "./helpers";

// The dagre-layout example: a tree of 11 nodes ("Idea" = `idea`, "Research", "Design", … down to
// "Launch"), 12 edges (`<source>-<target>`; "Findings" and "Roadmap" join two branches) laid out
// by dagre, opened top to bottom. The "Direction" radio group lays it out again, "Vertical" or
// "Horizontal": the root (the group "Dagre layout") carries `data-direction`, and `data-animating`
// while the nodes glide to their places. Each node prints its place (`data-position="x, y"`) and
// its handles' sides (`data-side`).

const LINKS = [
    ["idea", "research"],
    ["idea", "design"],
    ["research", "interviews"],
    ["research", "survey"],
    ["design", "sketches"],
    ["design", "prototype"],
    ["interviews", "findings"],
    ["survey", "findings"],
    ["prototype", "usability"],
    ["findings", "roadmap"],
    ["usability", "roadmap"],
    ["roadmap", "launch"],
] as const;

test.beforeEach(async ({ page }) => {
    await openExample(page, "dagre-layout");
});

const root = (page: Page) =>
    page.getByRole("group", { name: "Dagre layout", exact: true });
const direction = (page: Page) =>
    page.getByRole("group", { name: "Direction", exact: true });
const radio = (page: Page, name: "Vertical" | "Horizontal") =>
    direction(page).getByRole("radio", { name, exact: true });

/** Picks a direction and waits for the layout's animation to end. */
async function arrange(page: Page, name: "Vertical" | "Horizontal") {
    await radio(page, name).check();
    await expect(root(page)).toHaveAttribute(
        "data-direction",
        name.toLowerCase(),
    );
    await expect(root(page)).not.toHaveAttribute("data-animating");
}

/** Every node's printed place. */
async function positions(page: Page) {
    return part(page, "node").evaluateAll((elements) =>
        Object.fromEntries(
            elements.map((element) => [
                element.getAttribute("data-flow-id"),
                element.getAttribute("data-position"),
            ]),
        ),
    );
}

/** Expects every child's box below its parent's (vertical) or to its right (horizontal). */
async function expectArranged(page: Page, way: "vertical" | "horizontal") {
    const boxes = await nodeBoxes(page);
    for (const [source, target] of LINKS) {
        const parent = boxIn(boxes, source);
        const child = boxIn(boxes, target);
        if (way === "vertical") {
            expect(child.y, `${target} below ${source}`).toBeGreaterThan(
                parent.y + parent.height,
            );
        } else {
            expect(child.x, `${target} right of ${source}`).toBeGreaterThan(
                parent.x + parent.width,
            );
        }
    }
}

/** Expects every node's input and output handles on the direction's sides. */
async function expectSides(page: Page, target: string, source: string) {
    for (const element of await part(page, "node").all()) {
        const id = (await element.getAttribute("data-flow-id")) ?? "";
        await expect(handle(page, id, "target")).toHaveAttribute(
            "data-side",
            target,
        );
        await expect(handle(page, id, "source")).toHaveAttribute(
            "data-side",
            source,
        );
    }
}

test("opens laid out top to bottom, handles on top and bottom", async ({
    page,
}) => {
    await expect(root(page)).toHaveAttribute("data-direction", "vertical");
    await expect(root(page)).not.toHaveAttribute("data-animating");
    await expect(radio(page, "Vertical")).toBeChecked();
    await expect(part(page, "node")).toHaveCount(11);
    await expect(part(page, "edge")).toHaveCount(12);
    await expectArranged(page, "vertical");
    await expectSides(page, "top", "bottom");
});

test("Horizontal lays it out left to right, and Vertical back", async ({
    page,
}) => {
    const vertical = await positions(page);
    await arrange(page, "Horizontal");
    await expect(radio(page, "Horizontal")).toBeChecked();
    await expectSides(page, "left", "right");
    const horizontal = await positions(page);
    for (const [id, place] of Object.entries(vertical)) {
        if (id !== "idea")
            expect(horizontal[id], `${id} moved`).not.toBe(place);
    }
    // the boxes on screen keep their order while the view fits again (one transform for all)
    await expectArranged(page, "horizontal");

    await arrange(page, "Vertical");
    await expectSides(page, "top", "bottom");
    expect(await positions(page)).toEqual(vertical);
    await expectArranged(page, "vertical");
});

test("every control, node and edge is named", async ({ page }) => {
    await expect(root(page)).toHaveCount(1);
    await expect(direction(page).getByRole("radio")).toHaveCount(2);
    await expect(radio(page, "Vertical")).toHaveCount(1);
    await expect(radio(page, "Horizontal")).toHaveCount(1);
    for (const element of await part(page, "node").all()) {
        await expect(element).toHaveAccessibleName(/\S/);
    }
    for (const element of await part(page, "edge").all()) {
        await expect(element).toHaveAccessibleName(/\S/);
    }
    await expect(node(page, "usability")).toHaveAccessibleName(
        "Usability test",
    );
    await expect(
        page.getByTestId("stage").getByRole("group", {
            name: "Findings to Roadmap",
            exact: true,
        }),
    ).toHaveCount(1);
});
