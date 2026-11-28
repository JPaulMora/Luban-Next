// Order of objects in the laser and CNC workspaces: the object list order and
// the stack of objects under the pointer on the canvas.

/**
 * Move the item at `from` so it lands before the item now at `insertBefore`.
 * `insertBefore` runs from 0 to `list.length` (the end) and is clamped to that
 * range. Returns the same array when nothing moves, otherwise a new one.
 */
export function moveToInsertPosition<T>(list: T[], from: number, insertBefore: number): T[] {
    if (from < 0 || from >= list.length) {
        return list;
    }
    const target = Math.max(0, Math.min(insertBefore, list.length));
    if (target === from || target === from + 1) {
        return list;
    }
    const result = list.slice();
    const [item] = result.splice(from, 1);
    result.splice(target > from ? target - 1 : target, 0, item);
    return result;
}

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
