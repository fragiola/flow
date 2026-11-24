import { Component, computed } from "@angular/core";
import { injectViewport } from "@fragiola/flow-angular";
import { detailOf } from "./detail";

/** The zoom as a percentage and the level it gives, from `injectViewport()` (on the app's `<p>`). */
@Component({
    selector: "[exampleZoomReadout]",
    template: `{{ percent() }}% · {{ detail() }} detail`,
})
export class ZoomReadout {
    private readonly viewport = injectViewport();
    protected readonly percent = computed(() =>
        Math.round(this.viewport().zoom * 100),
    );
    protected readonly detail = computed(() => detailOf(this.viewport().zoom));
}
