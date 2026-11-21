import { expect, test } from "@playwright/test";
import { handle, openExample, part } from "../helpers";
import { dragTo, middle } from "./helpers";

test.beforeEach(async ({ page }) => {
    await openExample(page, "connection-validation");
});

test("a port joins a port of its own type", async ({ page }) => {
    await dragTo(
        page,
        handle(page, "name", "source", "text-0"),
        handle(page, "format", "target", "text-1"),
    );
    await expect(part(page, "edge")).toHaveCount(2);
    await expect(page.getByTestId("outcome")).toHaveText("Connected.");
});

test("a port of another type is marked invalid while dragging, and refused", async ({
    page,
}) => {
    // a number output over a text input
    const print = handle(page, "print", "target", "text-0");
    const to = await middle(print);
    const count = handle(page, "count", "source", "number-0");
    const start = await middle(count);
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(to.x, to.y, { steps: 10 });
    await expect(print).toHaveAttribute("data-invalid", "");
    await page.mouse.up();
    await expect(part(page, "edge")).toHaveCount(1);
    await expect(page.getByTestId("outcome")).toHaveText(/Refused/);
});

test("an input takes one edge, and no edge closes a cycle", async ({
    page,
}) => {
    await dragTo(
        page,
        handle(page, "count", "source", "number-0"),
        handle(page, "format", "target", "number-0"),
    );
    await expect(page.getByTestId("outcome")).toHaveText(/Refused/);
    await dragTo(
        page,
        handle(page, "format", "source", "text-0"),
        handle(page, "print", "target", "text-0"),
    );
    await expect(part(page, "edge")).toHaveCount(2);
    await dragTo(
        page,
        handle(page, "print", "source", "text-0"),
        handle(page, "format", "target", "text-1"),
    );
    await expect(page.getByTestId("outcome")).toHaveText(/Refused/);
    await expect(part(page, "edge")).toHaveCount(2);
});
