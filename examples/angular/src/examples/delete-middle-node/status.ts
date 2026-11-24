import { Component, effect, signal } from "@angular/core";
import { injectFlow } from "@fragiola/flow-angular";
import type { Features, Types } from "./index";

/** What the last deletion did: the `said` of the batches the model commits. */
@Component({
    selector: "p[exampleDeleteStatus]",
    template: `{{ said() }}`,
})
export class Status {
    protected readonly said = signal(
        "Select a node and press Delete, or use its delete button.",
    );

    constructor() {
        const { model } = injectFlow<Types, Features>();
        // listens to the model while the status is shown (the effect stops with the component)
        effect((onCleanup) => {
            onCleanup(
                model().subscribe((event) => {
                    if (typeof event.meta?.said === "string") {
                        this.said.set(event.meta.said);
                    }
                }),
            );
        });
    }
}
