import { expect, type Page, test } from "@playwright/test";
import { edge, node, openExample, part } from "../helpers";

// The auto-layout example: a mind map of 9 topics ("Product launch" = `launch`, its teams
// "Marketing", "Engineering", "Support", and their tasks: "Campaign" and "Press kit" under
// Marketing, …) laid out by dagre top to bottom, each topic with a "+" placeholder node under it
// (`add-<topic>`, the button "Add a child to <Label>"), edges `<source>-<target>`. Adding a child
// (`topic-1` "Topic 1", …) or collapsing a topic (the toggle "Collapse <Label>", `aria-expanded`)
// lays the shown nodes out again: the root (the group "Auto layout") carries `data-animating`
// while they glide and counts the finished layouts in `data-layouts`, each topic prints its
// place (`data-position="x, y"`), a collapsed one carries `data-collapsed`.

const TOPICS = [
    "launch",
    "marketing",
    "engineering",
    "support",
    "campaign",
    "press",
    "backend",
    "frontend",
    "docs",
];

test.beforeEach(async ({ page }) => {
    await openExample(page, "auto-layout");
});

const root = (page: Page) =>
    page.getByRole("group", { name: "Auto layout", exact: true });
const button = (page: Page, name: string) =>
    page.getByTestId("stage").getByRole("button", { name, exact: true });

/** Every shown topic's printed place (placeholders print none). */
async function positions(page: Page) {
    return part(page, "node").evaluateAll((elements) =>
        Object.fromEntries(
            elements
                .filter((element) => element.hasAttribute("data-position"))
                .map((element) => [
                    element.getAttribute("data-flow-id"),
                    element.getAttribute("data-position"),
                ]),
        ),
    );
}

/** Presses a control, then waits for the layout it starts to end (`data-layouts` counts them). */
async function relayout(page: Page, control: string) {
    const done = Number(await root(page).getAttribute("data-layouts"));
    await button(page, control).click();
    await expect(root(page)).toHaveAttribute("data-layouts", String(done + 1));
    await expect(root(page)).not.toHaveAttribute("data-animating");
}

/**
 * Every drawn node's box on screen, read at one moment: the view may still be fitting itself
 * (one transform for all), so boxes read one by one could come from two zooms.
 */
async function boxes(page: Page) {
    const rects = await part(page, "node").evaluateAll((elements) =>
        elements.map((element) => {
            const { x, y, width, height } = element.getBoundingClientRect();
            return {
                id: element.getAttribute("data-flow-id") ?? "",
                x,
                y,
                width,
                height,
            };
        }),
    );
    return new Map(rects.map((rect) => [rect.id, rect]));
}

/** Expects no two of the nodes on screen to overlap. */
async function expectApart(page: Page) {
    const all = [...(await boxes(page)).values()];
    for (const [index, a] of all.entries()) {
        for (const b of all.slice(index + 1)) {
            const apart =
                a.x + a.width <= b.x ||
                b.x + b.width <= a.x ||
                a.y + a.height <= b.y ||
                b.y + b.height <= a.y;
            expect(apart, `${a.id} and ${b.id} apart`).toBe(true);
        }
    }
}

/** Expects `child`'s box below `parent`'s. */
async function expectBelow(page: Page, parent: string, child: string) {
    const all = await boxes(page);
    const top = all.get(parent);
    const below = all.get(child);
    expect(top, `${parent} drawn`).toBeDefined();
    expect(below, `${child} drawn`).toBeDefined();
    expect(below?.y ?? 0, `${child} below ${parent}`).toBeGreaterThan(
        (top?.y ?? 0) + (top?.height ?? 0),
    );
}

test("opens laid out: every topic with its placeholder, children below parents", async ({
    page,
}) => {
    await expect(root(page)).not.toHaveAttribute("data-animating");
    await expect(part(page, "node")).toHaveCount(18);
    await expect(part(page, "edge")).toHaveCount(17);
    for (const id of TOPICS) {
        await expect(node(page, `add-${id}`)).toHaveCount(1);
        await expectBelow(page, id, `add-${id}`);
    }
    await expectBelow(page, "launch", "marketing");
    await expectBelow(page, "marketing", "campaign");
    await expectApart(page);
});

test("the + adds a child below its parent, and the siblings make room", async ({
    page,
}) => {
    const before = await positions(page);
    await relayout(page, "Add a child to Marketing");
    await expect(node(page, "topic-1")).toHaveAccessibleName("Topic 1");
    await expect(node(page, "add-topic-1")).toHaveCount(1);
    await expect(node(page, "add-marketing")).toHaveCount(1);
    await expect(part(page, "node")).toHaveCount(20);
    await expect(part(page, "edge")).toHaveCount(19);
    await expect(edge(page, "marketing-topic-1")).toHaveAccessibleName(
        "Marketing to Topic 1",
    );
    await expectBelow(page, "marketing", "topic-1");
    await expectBelow(page, "topic-1", "add-topic-1");
    await expectApart(page);
    // the layout moved the tree to make room: a sibling, or the topics beside
    const after = await positions(page);
    const moved = Object.keys(before).filter((id) => after[id] !== before[id]);
    expect(moved.length, "some topic moved").toBeGreaterThan(0);

    // the new topic has its own +
    await relayout(page, "Add a child to Topic 1");
    await expect(node(page, "topic-2")).toHaveAccessibleName("Topic 2");
    await expectBelow(page, "topic-1", "topic-2");
    await expectApart(page);
});

test("collapsing a topic hides its subtree and lays out again; expanding brings it back", async ({
    page,
}) => {
    const before = await positions(page);
    const collapse = button(page, "Collapse Marketing");
    await expect(collapse).toHaveAttribute("aria-expanded", "true");
    await relayout(page, "Collapse Marketing");

    for (const id of ["campaign", "press", "add-campaign", "add-press"]) {
        await expect(node(page, id), `${id} hidden`).toHaveCount(0);
    }
    // its own + goes too, while it is collapsed
    await expect(node(page, "add-marketing")).toHaveCount(0);
    for (const id of [
        "marketing-campaign",
        "marketing-press",
        "marketing-add-marketing",
    ]) {
        await expect(edge(page, id), `${id} hidden`).toHaveCount(0);
    }
    await expect(part(page, "node")).toHaveCount(13);
    await expect(part(page, "edge")).toHaveCount(12);
    await expect(node(page, "marketing")).toHaveAttribute("data-collapsed");
    // the tree is laid out again without the subtree: some shown topic moved
    const collapsed = await positions(page);
    expect(
        Object.keys(collapsed).filter((id) => collapsed[id] !== before[id]),
        "some topic moved",
    ).not.toEqual([]);
    const expand = button(page, "Expand Marketing");
    await expect(expand).toHaveAttribute("aria-expanded", "false");
    await expectApart(page);

    await relayout(page, "Expand Marketing");
    await expect(node(page, "marketing")).not.toHaveAttribute("data-collapsed");
    await expect(part(page, "node")).toHaveCount(18);
    await expect(part(page, "edge")).toHaveCount(17);
    await expect(edge(page, "marketing-campaign")).toHaveCount(1);
    await expectBelow(page, "marketing", "campaign");
    // the same tree lays out the same: every topic back in its place
    expect(await positions(page)).toEqual(before);
});

test("expanding keeps a subtree hidden under a topic still collapsed", async ({
    page,
}) => {
    await relayout(page, "Add a child to Campaign");
    await relayout(page, "Collapse Campaign");
    await expect(node(page, "topic-1")).toHaveCount(0);
    await relayout(page, "Collapse Marketing");
    await expect(node(page, "campaign")).toHaveCount(0);

    await relayout(page, "Expand Marketing");
    await expect(node(page, "campaign")).toHaveAttribute("data-collapsed");
    await expect(node(page, "press")).toHaveCount(1);
    await expect(node(page, "topic-1")).toHaveCount(0);
    await expect(edge(page, "campaign-topic-1")).toHaveCount(0);

    await relayout(page, "Expand Campaign");
    await expect(node(page, "topic-1")).toHaveCount(1);
    await expectBelow(page, "campaign", "topic-1");
    await expectApart(page);
});

test("every control, node and edge is named", async ({ page }) => {
    await expect(root(page)).toHaveCount(1);
    for (const [id, label] of [
        ["launch", "Product launch"],
        ["press", "Press kit"],
        ["docs", "Help center"],
    ] as const) {
        await expect(node(page, id)).toHaveAccessibleName(label);
        await expect(button(page, `Add a child to ${label}`)).toHaveCount(1);
    }
    // a toggle on each topic with children, none on a leaf
    for (const label of [
        "Product launch",
        "Marketing",
        "Engineering",
        "Support",
    ]) {
        await expect(button(page, `Collapse ${label}`)).toHaveCount(1);
    }
    await expect(button(page, "Collapse Campaign")).toHaveCount(0);
    await expect(page.getByTestId("stage").getByRole("button")).toHaveCount(13);
    for (const element of await part(page, "edge").all()) {
        await expect(element).toHaveAccessibleName(/\S/);
    }
    await expect(edge(page, "launch-marketing")).toHaveAccessibleName(
        "Product launch to Marketing",
    );
    await expect(edge(page, "press-add-press")).toHaveAccessibleName(
        "Press kit to its add button",
    );
});
