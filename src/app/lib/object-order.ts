// Order of objects in the laser and CNC workspaces: the stack of objects under
// the pointer on the canvas.

/**
 * Pick the object for Alt+click. `stack` lists the objects under the pointer
 * from the top down. With exactly one of them selected, take the one below it,
 * and after the lowest start at the top again. Otherwise take the one below the
 * top, or the top when it is alone.
 */
export function nextStackedTarget<T>(stack: T[], selected: T[]): T | null {
    if (stack.length === 0) {
        return null;
    }
    if (selected.length === 1) {
        const index = stack.indexOf(selected[0]);
        if (index !== -1) {
            return stack[(index + 1) % stack.length];
        }
    }
    return stack.length > 1 ? stack[1] : stack[0];
}
