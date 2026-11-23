import { expect, type Page, test } from "@playwright/test";
import { edge, node, openExample, part } from "../helpers";

// The delete-middle-node example: deleting a node joins each node that led into it to each node it
// led to, so a chain stays connected. The Delete key on a selected node and the node's own delete
// button (named `Delete <label>`) do the same. Merge has two incomers (Upload, Email) and two
// outgoers (Archive, Index), and Upload already reaches Archive: deleting it adds the three
// missing edges, never a second Upload to Archive.

test.beforeEach(async ({ page }) => {
    await openExample(page, "delete-middle-node");
});

const stage = (page: Page) => page.getByTestId("stage");

/** An edge by its accessible name (`<source> to <target>`). */
const named = (page: Page, name: string) =>
    stage(page).getByRole("group", { name, exact: true });

test("Delete on the selected middle of a chain keeps the chain connected", async ({
    page,
}) => {
    await expect(edge(page, "fetch-parse")).toHaveCount(1);
    await expect(edge(page, "fetch-store")).toHaveCount(0);
    const parse = node(page, "parse");
    await parse.focus();
    await page.keyboard.press("Enter");
    await expect(parse).toHaveAttribute("data-selected", "");
    await page.keyboard.press("Delete");
    await expect(node(page, "parse")).toHaveCount(0);
    await expect(edge(page, "fetch-parse")).toHaveCount(0);
    await expect(edge(page, "parse-store")).toHaveCount(0);
    await expect(edge(page, "fetch-store")).toHaveCount(1);
    await expect(named(page, "Fetch to Store")).toHaveAttribute(
        "data-flow-id",
        "fetch-store",
    );
    await expect(stage(page).getByTestId("outcome")).toHaveText(
        "Removed Parse; joined Fetch to Store.",
    );
});

test("the delete button joins every incomer to every outgoer, once", async ({
    page,
}) => {
    await expect(part(page, "edge")).toHaveCount(7);
    await stage(page).getByRole("button", { name: "Delete Merge" }).click();
    await expect(node(page, "merge")).toHaveCount(0);
    for (const name of [
        "Upload to Archive",
        "Upload to Index",
        "Email to Archive",
        "Email to Index",
    ]) {
        await expect(named(page, name)).toHaveCount(1);
    }
    // the chain's two edges and the four around Merge: no duplicate Upload to Archive
    await expect(part(page, "edge")).toHaveCount(6);
    await expect(edge(page, "upload-archive")).toHaveCount(1);
    await expect(edge(page, "upload-index")).toHaveCount(1);
    await expect(edge(page, "email-archive")).toHaveCount(1);
    await expect(edge(page, "email-index")).toHaveCount(1);
});

test("deleting an end of a chain adds nothing", async ({ page }) => {
    await stage(page).getByRole("button", { name: "Delete Store" }).click();
    await expect(node(page, "store")).toHaveCount(0);
    await expect(part(page, "edge")).toHaveCount(6);
    await expect(stage(page).getByTestId("outcome")).toHaveText(
        "Removed Store.",
    );
});

test("Delete on a selected edge alone names the edge it removed", async ({
    page,
}) => {
    const target = edge(page, "fetch-parse");
    await target.focus();
    await page.keyboard.press("Enter");
    await expect(target).toHaveAttribute("data-selected", "");
    await page.keyboard.press("Delete");
    await expect(edge(page, "fetch-parse")).toHaveCount(0);
    await expect(part(page, "node")).toHaveCount(8);
    await expect(part(page, "edge")).toHaveCount(6);
    await expect(stage(page).getByTestId("outcome")).toHaveText(
        "Removed Fetch to Parse.",
    );
});

test("every node and edge a keyboard reaches is named", async ({ page }) => {
    const nodes = part(page, "node");
    await expect(nodes).toHaveCount(8);
    for (const element of await nodes.all()) {
        await expect(element).toHaveAccessibleName(/\S/);
    }
    for (const element of await part(page, "edge").all()) {
        await expect(element).toHaveAccessibleName(/\S/);
    }
    await expect(named(page, "Fetch to Parse")).toHaveCount(1);
    await expect(
        stage(page).getByRole("button", { name: "Delete Parse" }),
    ).toHaveCount(1);
});
