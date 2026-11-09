import React, { useCallback, useRef, useState } from 'react';

import { editorStore } from '../../../store/local-storage';

// Maps the start size and the pointer movement since the drag began to the new size.
export type ResizeFunction<T> = (size: T, dx: number, dy: number) => Partial<T>;

declare interface ResizeDrag<T> {
    x: number;
    y: number;
    size: T;
    resize: ResizeFunction<T>;
}

// Drag-to-resize for the laser and CNC list cards. The size is kept in
// editor.json under storeKey and clamped again on every render, in case the
// window got smaller since it was saved. defaultSize and clampSize must not
// change between renders.
const useListResize = <T extends object>(storeKey: string, defaultSize: T, clampSize: (size: Partial<T>) => T) => {
    const [size, setSize] = useState<T>(() => clampSize(editorStore.get(storeKey, defaultSize)));
    const sizeRef = useRef<T>(size);
    const dragRef = useRef<ResizeDrag<T> | null>(null);

    const updateSize = useCallback((nextSize: T) => {
        sizeRef.current = nextSize;
        setSize(nextSize);
    }, []);

    const onResizeStart = useCallback((event: React.PointerEvent<HTMLDivElement>, resize: ResizeFunction<T>) => {
        if (event.button !== 0) {
            return;
        }
        event.preventDefault();
        event.stopPropagation();
        event.currentTarget.setPointerCapture(event.pointerId);
        dragRef.current = { x: event.clientX, y: event.clientY, size: sizeRef.current, resize };
    }, []);

    const onResizeMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
        const drag = dragRef.current;
        if (!drag) {
            return;
        }
        updateSize(clampSize({
            ...drag.size,
            ...drag.resize(drag.size, event.clientX - drag.x, event.clientY - drag.y),
        }));
    }, [clampSize, updateSize]);

    const onResizeEnd = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
        if (!dragRef.current) {
            return;
        }
        dragRef.current = null;
        event.currentTarget.releasePointerCapture(event.pointerId);
        editorStore.set(storeKey, sizeRef.current);
    }, [storeKey]);

    const onResizeReset = useCallback(() => {
        updateSize(clampSize(defaultSize));
        editorStore.set(storeKey, defaultSize);
    }, [clampSize, defaultSize, storeKey, updateSize]);

    return {
        size: clampSize(size),
        onResizeStart,
        onResizeMove,
        onResizeEnd,
        onResizeReset,
    };
};

export default useListResize;
