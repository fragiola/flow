import { Component, signal } from "@angular/core";
import {
    type BackgroundVariant,
    createFlowModel,
    FLOW,
    type FlowNodeInput,
    type FlowTypes,
} from "@fragiola/flow-angular";
import { drag } from "@fragiola/flow-angular/drag";
import { styles } from "./styles";

// `flowBackground` draws one SVG pattern that pans and zooms with the flow: `dots`, `lines` or
// `cross`, every `gap` flow units, its marks `size` units big, in `currentColor`. Two backgrounds
// layer: here a coarse grid of lines every five cells over the chosen pattern.

interface Types extends FlowTypes {
    readonly nodes: { card: { label: string } };
}

const features = [drag()] as const;

const VARIANTS: { value: BackgroundVariant; label: string }[] = [
    { value: "dots", label: "Dots" },
    { value: "lines", label: "Lines" },
    { value: "cross", label: "Cross" },
];

const GAPS = [16, 24, 40];

const nodes: FlowNodeInput<Types>[] = [
    {
        id: "a",
        type: "card",
        position: { x: 0, y: 0 },
        data: { label: "Drag me" },
    },
    {
        id: "b",
        type: "card",
        position: { x: 240, y: 120 },
        data: { label: "Zoom out" },
    },
];

@Component({
    selector: "example-backgrounds",
    imports: [FLOW],
    host: { class: "contents" },
    template: `
        <div [class]="styles.layout">
            <div role="toolbar" aria-label="Background" [class]="styles.toolbar">
                <fieldset [class]="styles.group">
                    <legend [class]="styles.legend">Pattern</legend>
                    @for (option of variants; track option.value) {
                        <button
                            type="button"
                            [attr.aria-pressed]="variant() === option.value"
                            (click)="variant.set(option.value)"
                            [class]="styles.segment"
                        >
                            {{ option.label }}
                        </button>
                    }
                </fieldset>
                <fieldset [class]="styles.group">
                    <legend [class]="styles.legend">Gap</legend>
                    @for (value of gaps; track value) {
                        <button
                            type="button"
                            [attr.aria-pressed]="gap() === value"
                            (click)="gap.set(value)"
                            [class]="styles.segment"
                        >
                            {{ value }}
                        </button>
                    }
                </fieldset>
                <label [class]="styles.check">
                    <input
                        type="checkbox"
                        [checked]="coarse()"
                        (change)="showCoarse($event)"
                    />
                    Coarse grid
                </label>
            </div>
            <div flowRoot [model]="model" [fitView]="{ padding: 0.2, maxZoom: 1 }" [class]="styles.root">
                <svg
                    flowBackground
                    data-testid="pattern"
                    [variant]="variant()"
                    [gap]="gap()"
                    [size]="variant() === 'dots' ? 2.5 : variant() === 'cross' ? 8 : 1"
                    [class]="styles.pattern"
                ></svg>
                @if (coarse()) {
                    <svg
                        flowBackground
                        data-testid="coarse-grid"
                        variant="lines"
                        [gap]="gap() * 5"
                        [size]="1.5"
                        [class]="styles.coarse"
                    ></svg>
                }
                <div flowViewport>
                    <div flowNodes>
                        <ng-template [flowNodesItem]="model" let-node>
                            <div [flowNode]="node" [class]="styles.node">{{ node.data.label }}</div>
                        </ng-template>
                    </div>
                </div>
            </div>
        </div>
    `,
})
export default class Backgrounds {
    protected readonly styles = styles;
    protected readonly variants = VARIANTS;
    protected readonly gaps = GAPS;
    protected readonly variant = signal<BackgroundVariant>("dots");
    protected readonly gap = signal(24);
    protected readonly coarse = signal(true);
    protected readonly model = createFlowModel<Types, typeof features>(
        { version: 1, nodes, edges: [] },
        { features },
    );

    protected showCoarse(event: Event): void {
        this.coarse.set((event.target as HTMLInputElement).checked);
    }
}
