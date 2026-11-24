import { Component, DestroyRef, inject, signal } from "@angular/core";
import { injectFlow } from "@fragiola/flow-angular";
import { LucideFileCode, LucideImage } from "@lucide/angular";
import { downloadBlob, lookOf, pngOf, svgBlob } from "./download";
import { flowSvg } from "./flow-svg";
import type { features, Types } from "./index";
import { styles } from "./styles";

/** The toolbar: the two downloads and what the last one did. */
@Component({
    selector: "example-export-toolbar",
    imports: [LucideFileCode, LucideImage],
    host: { class: "contents" },
    template: `
        <div role="toolbar" aria-label="Export" data-flow-no-gesture="" [class]="styles.panel">
            <button type="button" (click)="onSvg($event)" [class]="styles.primary">
                <svg lucideFileCode aria-hidden="true"></svg>
                Download SVG
            </button>
            <button type="button" (click)="onPng($event)" [class]="styles.button">
                <svg lucideImage aria-hidden="true"></svg>
                Download PNG
            </button>
            <p role="status" data-testid="message" [class]="styles.message">{{ message() }}</p>
        </div>
    `,
})
export class ExportToolbar {
    protected readonly styles = styles;
    private readonly flow = injectFlow<Types, typeof features>();
    protected readonly message = signal(
        "Drag the nodes, then download the flow.",
    );
    // a PNG still drawing when the toolbar goes away is not saved
    private destroyed = false;

    constructor() {
        inject(DestroyRef).onDestroy(() => {
            this.destroyed = true;
        });
    }

    /** The SVG of the document as it is now, in the look of the page's theme. */
    private svgFrom(event: MouseEvent) {
        const button = event.currentTarget as HTMLButtonElement;
        const root = button.closest('[data-flow-part="root"]');
        const json = this.flow.model().get("flow-json");
        const svg = flowSvg(json, { look: root ? lookOf(root) : {} });
        return {
            svg,
            counts: `${json.nodes.length} nodes, ${json.edges.length} edges`,
        };
    }

    protected onSvg(event: MouseEvent): void {
        const { svg, counts } = this.svgFrom(event);
        downloadBlob(svgBlob(svg.markup), "flow.svg");
        this.message.set(`Downloaded flow.svg (${counts}).`);
    }

    protected async onPng(event: MouseEvent): Promise<void> {
        const { svg, counts } = this.svgFrom(event);
        try {
            const png = await pngOf(svg);
            if (this.destroyed) return;
            downloadBlob(png, "flow.png");
            this.message.set(`Downloaded flow.png (${counts}).`);
        } catch {
            if (!this.destroyed)
                this.message.set("This browser could not draw the PNG.");
        }
    }
}
