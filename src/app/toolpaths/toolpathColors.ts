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

export function toolpathLineColor(index: number): ToolpathLineColor {
    const color = TOOLPATH_LINE_COLORS[index % TOOLPATH_LINE_COLORS.length];
    return [color[0], color[1], color[2]];
}

export function toolpathLineColorCss(color: ToolpathLineColor): string {
    return `rgb(${color[0]}, ${color[1]}, ${color[2]})`;
}
