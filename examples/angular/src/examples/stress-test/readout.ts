import {
    Component,
    computed,
    DestroyRef,
    DOCUMENT,
    inject,
    input,
    signal,
} from "@angular/core";
import { formatMs, frameMeter } from "./frames";
import { styles } from "./styles";

// The readout: the size, the nodes and edges in the DOM and the frame time, read a few times a
// second, and the last switch's and shuffle's times. A component of its own, so its reads check
// this view alone (in the example's template they would check every node's view again).

interface Counts {
    readonly nodes: number;
    readonly edges: number;
    readonly frameMs: number | undefined;
}

@Component({
    selector: "dl[exampleReadout]",
    host: {
        "[attr.data-size]": "size()",
        "[attr.data-edges]": "edges()",
        "[attr.data-dom-nodes]": "counts().nodes",
        "[attr.data-dom-edges]": "counts().edges",
        "[attr.data-frame-ms]": "frameMs()",
        "[attr.data-render-ms]": "render()",
        "[attr.data-shuffle-ms]": "shuffle()",
    },
    template: `
        <div [class]="styles.stat">
            <dt>In the DOM</dt>
            <dd [class]="styles.value">{{ counts().nodes }} nodes, {{ counts().edges }} edges</dd>
        </div>
        <div [class]="styles.stat">
            <dt>Frame</dt>
            <dd [class]="styles.value">{{ frameMs() }} ms</dd>
        </div>
        <div [class]="styles.stat">
            <dt>Rendered in</dt>
            <dd [class]="styles.value">{{ render() }} ms</dd>
        </div>
        <div [class]="styles.stat">
            <dt>Shuffled in</dt>
            <dd [class]="styles.value">{{ shuffle() }} ms</dd>
        </div>
    `,
})
export class Readout {
    protected readonly styles = styles;
    /** the element whose nodes and edges it counts */
    readonly frame = input.required<HTMLElement>();
    readonly size = input.required<number>();
    readonly edges = input.required<number>();
    readonly renderMs = input<number | undefined>(undefined);
    readonly shuffleMs = input<number | undefined>(undefined);
    protected readonly counts = signal<Counts>({
        nodes: 0,
        edges: 0,
        frameMs: undefined,
    });
    protected readonly frameMs = computed(() =>
        formatMs(this.counts().frameMs),
    );
    protected readonly render = computed(() => formatMs(this.renderMs()));
    protected readonly shuffle = computed(() => formatMs(this.shuffleMs()));

    constructor() {
        const document = inject(DOCUMENT);
        const meter = frameMeter(60);
        let ticks = 0;
        let id = requestAnimationFrame((time) => onFrame(time));
        const onFrame = (time: number) => {
            meter.tick(time);
            ticks += 1;
            // every 15th frame: a readout updated each frame would cost frames itself
            if (ticks % 15 === 0) {
                const root = this.frame();
                this.counts.set({
                    nodes: root.querySelectorAll('[data-flow-part="node"]')
                        .length,
                    edges: root.querySelectorAll('[data-flow-part="edge"]')
                        .length,
                    frameMs: meter.median(),
                });
            }
            id = requestAnimationFrame(onFrame);
        };
        // a hidden tab gets no frames: the gap after it is not a frame
        const onVisibility = () => meter.reset();
        document.addEventListener("visibilitychange", onVisibility);
        inject(DestroyRef).onDestroy(() => {
            cancelAnimationFrame(id);
            document.removeEventListener("visibilitychange", onVisibility);
        });
    }
}
