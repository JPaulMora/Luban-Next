export type ToolpathLineColor = [number, number, number];

// Distinct on the light process canvas. Cutting moves use these as 0–255 RGB.
const TOOLPATH_LINE_COLORS: ToolpathLineColor[] = [
    [226, 75, 75],
    [47, 111, 237],
    [31, 157, 85],
    [224, 122, 31],
    [142, 68, 200],
    [14, 138, 138],
    [199, 62, 120],
    [196, 160, 18],
];

export function toolpathLinePalette(): ToolpathLineColor[] {
    return TOOLPATH_LINE_COLORS.map((color) => [color[0], color[1], color[2]]);
}

export function toolpathLineColor(index: number): ToolpathLineColor {
    const color = TOOLPATH_LINE_COLORS[index % TOOLPATH_LINE_COLORS.length];
    return [color[0], color[1], color[2]];
}

export function sameToolpathLineColor(left: ToolpathLineColor, right: ToolpathLineColor): boolean {
    return !!left && !!right && left[0] === right[0] && left[1] === right[1] && left[2] === right[2];
}

// Prefer a palette entry no other path is using. After the palette is exhausted, repeat by count.
export function unusedToolpathLineColor(used: ToolpathLineColor[]): ToolpathLineColor {
    const free = TOOLPATH_LINE_COLORS.find((color) => {
        return !used.some((item) => sameToolpathLineColor(item, color));
    });
    if (free) {
        return [free[0], free[1], free[2]];
    }
    return toolpathLineColor(used.length);
}

export function toolpathLineColorCss(color: ToolpathLineColor): string {
    return `rgb(${color[0]}, ${color[1]}, ${color[2]})`;
}
