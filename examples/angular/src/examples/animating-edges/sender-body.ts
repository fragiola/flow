import { Component, effect, input, output } from "@angular/core";
import { type FlowEdge, injectFlowStore } from "@fragiola/flow-angular";
import { LucideSend } from "@lucide/angular";
import type { features, Types } from "./index";
import { styles } from "./styles";

/** The sender's body: "Send a value" starts the pulse while the flow still has its edge. */
@Component({
    selector: "[exampleSenderBody]",
    imports: [LucideSend],
    template: `
        {{ label() }}
        <button
            type="button"
            aria-label="Send a value"
            [disabled]="sending()"
            (click)="onSend()"
            [class]="styles.send"
        >
            <svg lucideSend aria-hidden="true"></svg>
            Send
        </button>
    `,
})
export class SenderBody {
    readonly label = input.required<string>();
    readonly sending = input.required<boolean>();
    readonly sendValue = output();
    /** the pulse's edge is gone: the value is dropped */
    readonly dropValue = output();
    protected readonly styles = styles;

    /** Whether the flow still has the edge that pulses: deleted, nothing carries a value. */
    private readonly pulse = injectFlowStore<boolean, Types, typeof features>(
        ({ model }) =>
            model
                .get("all-edges")
                .some(
                    (edge: FlowEdge<Types>) =>
                        edge.type === "animated" &&
                        edge.data?.motion === "pulse",
                ),
    );

    constructor() {
        // the pulse's edge deleted while a value was on its way: no animationend will come
        effect(() => {
            if (this.sending() && !this.pulse()) this.dropValue.emit();
        });
    }

    protected onSend(): void {
        if (this.pulse()) this.sendValue.emit();
    }
}
