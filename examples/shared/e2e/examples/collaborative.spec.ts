import { expect, type Page, test } from "@playwright/test";
import { openExample } from "../helpers";
import { boxOf, dragBy, dragTo, middle, near, press } from "./helpers";

// The collaborative example: two flows side by side, Alice's and Bob's (regions named so), share
// one document. A command on one side shows on the other: a drag (followed while it goes), an
// added node, a connection, a deletion. Each side shows the other's cursor with their name, and
// marks the nodes the other has selected (`data-remote-selected` with their name). Plan → Write,
// and Ship below them, unconnected.

test.beforeEach(async ({ page }) => {
    await openExample(page, "collaborative");
});

const side = (page: Page, name: "Alice" | "Bob") =>
    page.getByTestId("stage").getByRole("region", { name, exact: true });
const nodeOf = (page: Page, name: "Alice" | "Bob", id: string) =>
    side(page, name).locator(`[data-flow-part="node"][data-flow-id="${id}"]`);
const handleOf = (page: Page, name: "Alice" | "Bob", label: string) =>
    side(page, name)
        .locator('[data-flow-part="handle"]')
        .and(page.getByLabel(label, { exact: true }));

/** Where `id` sits from `from` on `name`'s side, in pixels (both sides share a zoom at first). */
async function offset(
    page: Page,
    name: "Alice" | "Bob",
    id: string,
    from: string,
) {
    const a = await boxOf(nodeOf(page, name, id));
    const b = await boxOf(nodeOf(page, name, from));
    return { x: a.x - b.x, y: a.y - b.y };
}

test("a drag on Alice's side moves Bob's node with it, while it goes", async ({
    page,
}) => {
    const before = await offset(page, "Bob", "plan", "write");
    await dragBy(page, nodeOf(page, "Alice", "plan"), 40, 70, {
        release: false,
    });
    // Bob follows the drag before it ends
    await expect
        .poll(async () => (await offset(page, "Bob", "plan", "write")).y)
        .toBeGreaterThan(before.y + 30);
    await page.mouse.up();
    await expect(nodeOf(page, "Alice", "plan")).not.toHaveAttribute(
        "data-dragging",
    );
    await expect
        .poll(async () => {
            const alice = await offset(page, "Alice", "plan", "write");
            const bob = await offset(page, "Bob", "plan", "write");
            return Math.abs(alice.x - bob.x) + Math.abs(alice.y - bob.y);
        })
        .toBeLessThan(2);
    const after = await offset(page, "Bob", "plan", "write");
    near(after.x - before.x, 40, 3);
    near(after.y - before.y, 70, 3);
});

test("a node added, connected and deleted on Bob's side shows on Alice's", async ({
    page,
}) => {
    await side(page, "Bob")
        .getByRole("button", { name: "Add node", exact: true })
        .click();
    await expect(nodeOf(page, "Alice", "bob-1")).toHaveAccessibleName("Bob 1");

    await dragTo(
        page,
        handleOf(page, "Bob", "Write output"),
        handleOf(page, "Bob", "Ship input"),
    );
    const edge = (name: "Alice" | "Bob") =>
        side(page, name).getByRole("group", {
            name: "write to ship",
            exact: true,
        });
    await expect(edge("Bob")).toHaveCount(1);
    await expect(edge("Alice")).toHaveCount(1);
    await expect(
        side(page, "Alice").locator('[data-flow-part="edge"]'),
    ).toHaveCount(2);

    await press(page, nodeOf(page, "Bob", "bob-1"));
    await expect(nodeOf(page, "Bob", "bob-1")).toHaveAttribute(
        "data-selected",
        "",
    );
    await page.keyboard.press("Delete");
    await expect(nodeOf(page, "Bob", "bob-1")).toHaveCount(0);
    await expect(nodeOf(page, "Alice", "bob-1")).toHaveCount(0);
});

test("each side shows the other's cursor with their name, and marks what they selected", async ({
    page,
}) => {
    const cursorOn = (name: "Alice" | "Bob") =>
        side(page, name).getByTestId("cursor");
    await expect(cursorOn("Alice")).toHaveCount(0);
    // the pointer over Bob's flow: Alice sees Bob's cursor where it is in the flow
    const write = await middle(nodeOf(page, "Bob", "write"));
    await page.mouse.move(write.x, write.y);
    await expect(cursorOn("Alice")).toHaveText("Bob");
    await expect(cursorOn("Alice")).toHaveAttribute("data-peer", "Bob");
    const cursor = await boxOf(cursorOn("Alice"));
    const target = await boxOf(nodeOf(page, "Alice", "write"));
    expect(cursor.x).toBeGreaterThan(target.x);
    expect(cursor.x).toBeLessThan(target.x + target.width);
    expect(cursor.y).toBeGreaterThan(target.y);
    expect(cursor.y).toBeLessThan(target.y + target.height);

    // over Alice's flow now: Bob's cursor leaves hers, hers shows on his
    const plan = await middle(nodeOf(page, "Alice", "plan"));
    await page.mouse.move(plan.x, plan.y, { steps: 4 });
    await expect(cursorOn("Alice")).toHaveCount(0);
    await expect(cursorOn("Bob")).toHaveText("Alice");

    // Alice selects Plan: Bob's Plan is marked, not selected
    await press(page, nodeOf(page, "Alice", "plan"));
    await expect(nodeOf(page, "Alice", "plan")).toHaveAttribute(
        "data-selected",
        "",
    );
    await expect(nodeOf(page, "Bob", "plan")).toHaveAttribute(
        "data-remote-selected",
        "Alice",
    );
    await expect(nodeOf(page, "Bob", "plan")).not.toHaveAttribute(
        "data-selected",
    );
    await expect(nodeOf(page, "Alice", "plan")).not.toHaveAttribute(
        "data-remote-selected",
    );
});

test("each side, flow, node and control is named", async ({ page }) => {
    for (const name of ["Alice", "Bob"] as const) {
        await expect(side(page, name)).toHaveCount(1);
        await expect(
            side(page, name).getByRole("group", {
                name: `${name}'s flow`,
                exact: true,
            }),
        ).toHaveCount(1);
        await expect(
            side(page, name).getByRole("heading", { name, exact: true }),
        ).toHaveCount(1);
        await expect(
            side(page, name).getByRole("button", {
                name: "Add node",
                exact: true,
            }),
        ).toHaveCount(1);
        const nodes = side(page, name).locator('[data-flow-part="node"]');
        await expect(nodes).toHaveCount(3);
        for (const element of await nodes.all())
            await expect(element).toHaveAccessibleName(/\S/);
        await expect(
            side(page, name).getByRole("group", {
                name: "plan to write",
                exact: true,
            }),
        ).toHaveCount(1);
    }
});
