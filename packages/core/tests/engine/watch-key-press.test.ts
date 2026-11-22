// @vitest-environment jsdom
// `watchKeyPress`: the combo syntax every adapter's `useKeyPress` takes, the keys held on the
// target it is given, and their release on blur and with Meta.
import { afterEach, describe, expect, it } from "vitest";
import { watchKeyPress } from "../../src/engine/watch-key-press";

const stops: (() => void)[] = [];
afterEach(() => {
    for (const stop of stops.splice(0)) stop();
});

/** Watches `keys` on `target`, recording every change. */
function watch(
    keys: string | readonly string[],
    target: EventTarget = document,
): boolean[] {
    const changes: boolean[] = [];
    stops.push(watchKeyPress(target, keys, (pressed) => changes.push(pressed)));
    return changes;
}

function press(
    type: "keydown" | "keyup",
    key: string,
    code: string,
    target: EventTarget = document,
): void {
    target.dispatchEvent(new KeyboardEvent(type, { key, code, bubbles: true }));
}

describe("watchKeyPress", () => {
    it("tells when one key starts and stops being held, once each", () => {
        const changes = watch("Shift");
        press("keydown", "Shift", "ShiftLeft");
        press("keydown", "Shift", "ShiftLeft");
        expect(changes).toEqual([true]);
        press("keyup", "Shift", "ShiftLeft");
        expect(changes).toEqual([true, false]);
    });

    it("matches a combo when all its keys are held, by key or code, without case", () => {
        const changes = watch(["Meta+s", "control+KeyS"]);
        press("keydown", "s", "KeyS");
        expect(changes).toEqual([]);
        press("keydown", "Control", "ControlLeft");
        expect(changes).toEqual([true]);
        press("keyup", "Control", "ControlLeft");
        expect(changes).toEqual([true, false]);
        press("keyup", "s", "KeyS");
        press("keydown", "Meta", "MetaLeft");
        press("keydown", "S", "KeyS");
        expect(changes).toEqual([true, false, true]);
    });

    it("forgets every key held when Meta is released, and when the window loses focus", () => {
        const changes = watch("a");
        press("keydown", "Meta", "MetaLeft");
        press("keydown", "a", "KeyA");
        // the platform swallows a's keyup while Meta is held
        press("keyup", "Meta", "MetaLeft");
        expect(changes).toEqual([true, false]);
        press("keydown", "a", "KeyA");
        window.dispatchEvent(new Event("blur"));
        expect(changes).toEqual([true, false, true, false]);
    });

    it("releases a key by its physical key, though Shift changed its name meanwhile", () => {
        const changes = watch("!");
        press("keydown", "Shift", "ShiftLeft");
        press("keydown", "!", "Digit1");
        press("keyup", "Shift", "ShiftLeft");
        press("keyup", "1", "Digit1");
        expect(changes).toEqual([true, false]);
    });

    it("reads only its target, and stops when told", () => {
        const element = document.createElement("div");
        document.body.append(element);
        const changes = watch(" ", element);
        press("keydown", " ", "Space");
        expect(changes).toEqual([]);
        press("keydown", " ", "Space", element);
        expect(changes).toEqual([true]);
        stops.pop()?.();
        press("keyup", " ", "Space", element);
        expect(changes).toEqual([true]);
        element.remove();
    });
});
