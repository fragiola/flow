// The browser's half of the export: the theme read off the drawn flow, the SVG drawn on a canvas
// as a PNG, and a file handed to the user. Framework-free, but it needs a DOM (the SVG itself is
// built without one, in flow-svg.ts).
import type { SvgLook } from "./flow-svg";

/** A length of a computed style in pixels (`"1.5px"` is 1.5), or undefined when not one. */
function pixels(value: string): number | undefined {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : undefined;
}

/**
 * The theme's look, resolved: the computed styles of the flow's own parts (the root's canvas and
 * font, a node's frame and text, an edge's stroke), so the file looks like the page in every
 * theme. What is not drawn yet keeps the default.
 */
export function lookOf(root: Element): Partial<SvgLook> {
    const look: Record<string, string | number | undefined> = {};
    const canvas = getComputedStyle(root);
    look.background = canvas.backgroundColor;
    look.fontFamily = canvas.fontFamily;
    // a node at rest: a selected one shows the selection's colours
    const frame = root.querySelector(
        '[data-flow-part="node"]:not([data-selected]) [data-frame]',
    );
    if (frame) {
        const style = getComputedStyle(frame);
        look.nodeFill = style.backgroundColor;
        look.nodeStroke = style.borderTopColor;
        look.nodeStrokeWidth = pixels(style.borderTopWidth);
        look.nodeRadius = pixels(style.borderTopLeftRadius);
        look.text = style.color;
        look.fontSize = pixels(style.fontSize);
        look.fontWeight = style.fontWeight;
    }
    const path = root.querySelector(
        '[data-flow-part="edge"]:not([data-selected]) [data-flow-part="edge-path"]',
    );
    if (path) {
        const style = getComputedStyle(path);
        look.edgeStroke = style.stroke;
        look.edgeWidth = pixels(style.strokeWidth);
        look.edgeDash = style.strokeDasharray.replaceAll("px", "");
    }
    return Object.fromEntries(
        Object.entries(look).filter(([, value]) => value !== undefined),
    ) as Partial<SvgLook>;
}

/** Hands `blob` to the user as a file named `name` (an anchor with `download`, clicked). */
export function downloadBlob(blob: Blob, name: string) {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = name;
    anchor.click();
    // the download has started from the URL; let it go once the click is handled
    setTimeout(() => URL.revokeObjectURL(url), 0);
}

/** The SVG as a blob, ready to save or to load as an image. */
export function svgBlob(markup: string): Blob {
    return new Blob([markup], { type: "image/svg+xml" });
}

/**
 * The SVG drawn on a canvas as a PNG, `scale` times its size (2 by default, sharp on a dense
 * screen): an image loaded from the SVG's blob, drawn, and `canvas.toBlob`.
 */
export async function pngOf(
    svg: { markup: string; width: number; height: number },
    scale = 2,
): Promise<Blob> {
    const url = URL.createObjectURL(svgBlob(svg.markup));
    try {
        const image = new Image();
        image.src = url;
        await image.decode();
        const canvas = document.createElement("canvas");
        canvas.width = Math.ceil(svg.width * scale);
        canvas.height = Math.ceil(svg.height * scale);
        const context = canvas.getContext("2d");
        if (!context) throw new Error("No 2D canvas");
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        return await new Promise<Blob>((resolve, reject) =>
            canvas.toBlob(
                (blob) =>
                    blob ? resolve(blob) : reject(new Error("No PNG drawn")),
                "image/png",
            ),
        );
    } finally {
        URL.revokeObjectURL(url);
    }
}
