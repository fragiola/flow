// examples/vue/tests/kit.test.ts for the Svelte app.
import { render } from "svelte/server";
import { describe, expect, it } from "vitest";
import { Input } from "#/components/atoms/fields";
import BadgeCase from "./fixtures/badge-case.svelte";
import FieldInput from "./fixtures/field-input.svelte";
import FieldSelect from "./fixtures/field-select.svelte";

// The Svelte ports of Fragiola UI render what the React pieces render: the same element, slot
// names and classes, so the shared e2e specs and the themes read both the same. A field's label
// names its control. The Select is a native <select> in the field's box (React's trigger classes).

describe("the Svelte UI pieces", () => {
    it("Badge is a span with the variant's classes and the palette from outside", () => {
        const out = render(BadgeCase).body;
        expect(out).toMatch(/<span[^>]*data-slot="badge"/);
        expect(out).toContain("border-palette-line");
        expect(out).toContain("palette-danger");
        expect(out).toContain("Read-only");
    });

    it("a field's label is for its input, which wears the control classes", () => {
        const out = render(FieldInput).body;
        const label = /<label[^>]*for="([^"]+)"/.exec(out)?.[1];
        expect(label).toBeTruthy();
        expect(out).toMatch(
            new RegExp(`<input[^>]*data-slot="input"[^>]*id="${label}"`),
        );
        expect(out).toContain('value="Start"');
        expect(out).toContain("field-control");
        expect(out).toContain('data-slot="field-row"');
        expect(out).toContain('data-slot="field-body"');
    });

    it("an input outside a field has no id", () => {
        const out = render(Input, { props: { value: "x" } }).body;
        expect(out).not.toContain("id=");
        expect(out).toContain('value="x"');
    });

    it("a field's label names its Select, a native select in the field's box with the chevron after it", () => {
        const out = render(FieldSelect).body;
        const label = /<label[^>]*for="([^"]+)"/.exec(out)?.[1];
        expect(label).toBeTruthy();
        expect(out).toMatch(new RegExp(`<select[^>]*id="${label}"`));
        // the field's row draws the focus ring around its control (`field-control`)
        expect(out).toMatch(/<select[^>]*class="[^"]*\bfield-control\b/);
        expect(out).toMatch(
            /data-slot="select-trigger"[^>]*class="[^"]*justify-between/,
        );
        expect(out).toMatch(/<option[^>]*value="schedule"[^>]*selected/);
        expect(out.indexOf("</select>")).toBeLessThan(out.indexOf("<svg"));
    });
});
