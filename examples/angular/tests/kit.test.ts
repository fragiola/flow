// @vitest-environment jsdom

import { Component, signal, type Type } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { afterEach, describe, expect, it } from "vitest";
import { Badge } from "#/components/atoms/badge";
import { Input } from "#/components/atoms/fields";
import { FIELD } from "#/components/ui/field";
import { SELECT } from "#/components/ui/select";

// The Angular ports render what the React pieces render: the same element, slot, classes and
// accessible names, so the shared e2e specs and the themes read both the same. The framework-free
// files are React's, byte for byte (tests/vendored.test.ts), and tested in examples/react.

afterEach(() => {
    TestBed.resetTestingModule();
    document.body.innerHTML = "";
});

/** Renders `component` and returns its element, once stable. */
async function render<T>(component: Type<T>) {
    const fixture = TestBed.createComponent(component);
    await fixture.whenStable();
    return {
        root: fixture.nativeElement as HTMLElement,
        fixture,
        stable: () => fixture.whenStable(),
    };
}

const classes = (element: Element | null) =>
    element?.getAttribute("class")?.split(/\s+/) ?? [];

describe("the Angular UI ports", () => {
    it("Badge is a span with the badge classes of its variant, and the app's class", async () => {
        @Component({
            imports: [Badge],
            template: `<span kitBadge variant="outline" [class]="'palette-danger'">Read only</span>`,
        })
        class Host {}
        const { root } = await render(Host);
        const badge = root.querySelector("span");
        expect(badge?.getAttribute("data-slot")).toBe("badge");
        expect(badge?.textContent).toBe("Read only");
        expect(classes(badge)).toEqual(
            expect.arrayContaining([
                "rounded-pill",
                "border-palette-line",
                "palette-danger",
            ]),
        );
        expect(classes(badge)).not.toContain("bg-palette-soft");
    });

    it("Field's label names its Input, each field with its own id", async () => {
        @Component({
            imports: [FIELD, Input],
            template: `
                @for (name of names; track name) {
                    <div kitFieldRoot>
                        <label kitFieldLabel>{{ name }}</label>
                        <div kitFieldRow>
                            <div kitFieldBody><input kitInput [value]="name" /></div>
                        </div>
                    </div>
                }
            `,
        })
        class Host {
            readonly names = ["Name", "Target"];
        }
        const { root } = await render(Host);
        const inputs = [...root.querySelectorAll("input")];
        const labels = [...root.querySelectorAll("label")];
        expect(inputs).toHaveLength(2);
        expect(inputs[0]?.id).toMatch(/^field-\d+$/);
        expect(inputs[0]?.id).not.toBe(inputs[1]?.id);
        expect(labels.map((label) => label.htmlFor)).toEqual(
            inputs.map((input) => input.id),
        );
        expect(inputs[0]?.labels?.[0]?.textContent).toBe("Name");
        expect(inputs[0]?.getAttribute("data-slot")).toBe("input");
        expect(
            root.querySelector("[kitFieldRow]")?.getAttribute("data-slot"),
        ).toBe("field-row");
        expect(
            classes(root.querySelector("[kitFieldRow]")).length,
        ).toBeGreaterThan(0);
        expect(
            root.querySelector("[kitFieldRoot]")?.getAttribute("data-slot"),
        ).toBe("field-root");
    });

    it("an Input outside a field has no id of its own", async () => {
        @Component({
            imports: [Input],
            template: `<input kitInput aria-label="Search" />`,
        })
        class Host {}
        const { root } = await render(Host);
        expect(root.querySelector("input")?.hasAttribute("id")).toBe(false);
    });

    it("Select is a native select named by its field's label, showing and changing its value", async () => {
        @Component({
            imports: [FIELD, SELECT],
            template: `
                <div kitFieldRoot>
                    <label kitFieldLabel>Starts on</label>
                    <kit-select [(value)]="kind">
                        @for (option of options; track option[0]) {
                            <option kitSelectItem [value]="option[0]">{{ option[1] }}</option>
                        }
                    </kit-select>
                </div>
            `,
        })
        class Host {
            readonly kind = signal("schedule");
            readonly options = [
                ["webhook", "Webhook"],
                ["schedule", "Schedule"],
            ] as const;
        }
        const { root, fixture, stable } = await render(Host);
        const select = root.querySelector("select");
        expect(select?.labels?.[0]?.textContent).toBe("Starts on");
        expect(select?.value).toBe("schedule");
        expect(
            [...(select?.options ?? [])].map((option) => option.textContent),
        ).toEqual(["Webhook", "Schedule"]);
        expect(select?.options[0]?.getAttribute("data-slot")).toBe(
            "select-item",
        );
        expect(
            root.querySelector("kit-select")?.getAttribute("data-slot"),
        ).toBe("select-trigger");

        if (!select) throw new Error("no select");
        select.value = "webhook";
        select.dispatchEvent(new Event("change"));
        await stable();
        expect(fixture.componentInstance.kind()).toBe("webhook");

        fixture.componentInstance.kind.set("schedule");
        await stable();
        expect(select.value).toBe("schedule");
    });
});
