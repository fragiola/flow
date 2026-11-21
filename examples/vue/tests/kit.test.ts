// From Splitter (fragiola/splitter, examples/vue/tests/kit.test.ts), same author and licence.
import { describe, expect, it } from "vitest";
import { createSSRApp, h } from "vue";
import { renderToString } from "vue/server-renderer";
import { Badge } from "#/components/atoms/badge";
import { Input } from "#/components/atoms/fields";
import { Field } from "#/components/ui/field";
import { Select } from "#/components/ui/select";

// The Vue ports of Fragiola UI render what the React pieces render: the same element, slot names
// and classes, so the shared e2e specs and the themes read both the same. A field's label names
// its control.

const render = (node: () => ReturnType<typeof h>) =>
    renderToString(createSSRApp({ render: node }));

describe("the Vue UI pieces", () => {
    it("Badge is a span with the variant's classes and the palette from outside", async () => {
        const html = await render(() =>
            h(
                Badge,
                { variant: "outline", class: "palette-danger" },
                () => "Read-only",
            ),
        );
        expect(html).toMatch(/^<span/);
        expect(html).toContain('data-slot="badge"');
        expect(html).toContain("border-palette-line");
        expect(html).toContain("palette-danger");
        expect(html).toContain("Read-only");
    });

    it("a field's label is for its input, which wears the control classes", async () => {
        const html = await render(() =>
            h(Field.Root, null, () => [
                h(Field.Label, null, () => "Name"),
                h(Field.Row, null, () =>
                    h(Field.Body, null, () =>
                        h(Input, { modelValue: "Start" }),
                    ),
                ),
            ]),
        );
        const label = /<label[^>]*for="([^"]+)"/.exec(html)?.[1];
        expect(label).toBeTruthy();
        expect(html).toContain(`<input data-slot="input" id="${label}"`);
        expect(html).toContain('value="Start"');
        expect(html).toContain("field-control");
        expect(html).toContain('data-slot="field-row"');
        expect(html).toContain('data-slot="field-body"');
    });

    it("an input outside a field has no id", async () => {
        const html = await render(() => h(Input, { modelValue: "x" }));
        expect(html).not.toContain("id=");
        expect(html).toContain('value="x"');
    });

    it("a field's label names its Select's trigger", async () => {
        const html = await render(() =>
            h(Field.Root, null, () => [
                h(Field.Label, null, () => "Starts on"),
                h(Select.Root, { modelValue: "webhook" }, () =>
                    h(Select.Trigger, null, () =>
                        h(Select.Value, null, () => "Webhook"),
                    ),
                ),
            ]),
        );
        const label = /<label[^>]*for="([^"]+)"/.exec(html)?.[1];
        expect(label).toBeTruthy();
        expect(html).toMatch(
            new RegExp(
                `<button[^>]*id="${label}"[^>]*role="combobox"|<button[^>]*role="combobox"[^>]*id="${label}"`,
            ),
        );
    });

    it("Select's trigger is a field row, with the chevron after its value", async () => {
        const html = await render(() =>
            h(Select.Root, { modelValue: "webhook" }, () => [
                h(Select.Trigger, { "aria-label": "Starts on" }, () =>
                    h(Select.Value, null, () => "Webhook"),
                ),
                h(Select.Content, null, () =>
                    h(Select.Item, { value: "webhook" }, () => "Webhook"),
                ),
            ]),
        );
        expect(html).toContain('data-slot="select-trigger"');
        expect(html).toContain('role="combobox"');
        expect(html).toContain('aria-label="Starts on"');
        expect(html).toContain("justify-between");
        expect(html).toContain('data-slot="select-value"');
        expect(html).toContain("Webhook");
        expect(html).toContain("<svg");
    });
});
