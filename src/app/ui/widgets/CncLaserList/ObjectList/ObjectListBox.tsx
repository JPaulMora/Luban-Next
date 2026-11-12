import classNames from 'classnames';
import React, { useEffect, useCallback, useRef, useState } from 'react';
import { shallowEqual, useDispatch, useSelector } from 'react-redux';

import { actions as editorActions } from '../../../../flux/editor';
import i18n from '../../../../lib/i18n';
import modal from '../../../../lib/modal';
import styles from '../styles.styl';
import useListResize, { ResizeFunction } from '../useListResize';
import ModelItem from './model-item';


interface ObjectListBoxProps {
    headType: 'laser' | 'cnc';
}

declare interface ListSize {
    width: number;
    height: number;
}

// Size of the list area below the card title, shared by laser and CNC and kept
// in editor.json. The height is a max-height, so a short list stays short and a
// long one scrolls.
const SIZE_STORE_KEY = 'objectListSize';
const DEFAULT_SIZE: ListSize = { width: 264, height: 176 };
const MIN_SIZE: ListSize = { width: 264, height: 96 };

const clampSize = (size: Partial<ListSize>): ListSize => {
    const maxWidth = Math.max(MIN_SIZE.width, Math.round(window.innerWidth * 0.5));
    const maxHeight = Math.max(MIN_SIZE.height, Math.round(window.innerHeight * 0.6));
    const width = Number(size?.width) || DEFAULT_SIZE.width;
    const height = Number(size?.height) || DEFAULT_SIZE.height;
    return {
        width: Math.round(Math.min(Math.max(width, MIN_SIZE.width), maxWidth)),
        height: Math.round(Math.min(Math.max(height, MIN_SIZE.height), maxHeight)),
    };
};

// The list sits at the bottom left of the canvas, so it grows up and to the right.
const growUp: ResizeFunction<ListSize> = (size, dx, dy) => ({ height: size.height - dy });
const growUpAndRight: ResizeFunction<ListSize> = (size, dx, dy) => ({ width: size.width + dx, height: size.height - dy });

// A row follows the pointer once it moved this far, so a click still selects.
const DRAG_START_DISTANCE = 4;
// Dragging this close to the top or bottom edge scrolls the list.
const DRAG_SCROLL_EDGE = 16;
const DRAG_SCROLL_STEP = 8;

declare interface RowDrag {
    model: { modelID: string };
    pointerId: number;
    startY: number;
    active: boolean;
}

declare interface DropMark {
    // The row moves before the row at this index; the row count means the end.
    index: number;
    top: number;
}

// Where a row dropped at clientY lands, and where the drop line goes.
const dropMarkAt = (rowsElement: HTMLElement, clientY: number): DropMark => {
    const rows = Array.from(rowsElement.querySelectorAll<HTMLElement>('[data-model-id]'));
    for (let i = 0; i < rows.length; i++) {
        const rect = rows[i].getBoundingClientRect();
        if (clientY < rect.top + rect.height / 2) {
            return { index: i, top: rows[i].offsetTop };
        }
    }
    const last = rows[rows.length - 1];
    return { index: rows.length, top: last ? last.offsetTop + last.offsetHeight : 0 };
};

const ObjectListBox: React.FC<ObjectListBoxProps> = ({ headType }) => {
    const selectedModelArray = useSelector(state => state[headType].modelGroup?.selectedModelArray);
    const models = useSelector(state => state[headType]?.modelGroup?.models);
    // The row last clicked without Shift: one end of a Shift+click range.
    const rangeAnchorRef = useRef(null);

    const inProgress = useSelector(state => state[headType]?.inProgress, shallowEqual);
    const previewFailed = useSelector(state => state[headType]?.previewFailed, shallowEqual);

    const dispatch = useDispatch();

    const {
        size: shownSize, onResizeStart, onResizeMove, onResizeEnd, onResizeReset
    } = useListResize<ListSize>(SIZE_STORE_KEY, DEFAULT_SIZE, clampSize);

    const onSelectItem = useCallback((model, event) => {
        // Ctrl+click (Cmd+click on macOS) adds or removes one model. Shift+click
        // selects every visible model from the anchor row to this one. Without an
        // anchor in the list, a single selected model is the anchor.
        let isMultiSelect = event.ctrlKey || event.metaKey;

        // TODO: Add comment here
        if (selectedModelArray.length === 1 && selectedModelArray[0].visible === false) {
            isMultiSelect = false;
        }
        // TODO: Add comment here
        if (selectedModelArray.length > 0 && model.visible === false) {
            isMultiSelect = false;
        }

        const listModels = models.filter(item => !item.supportTag);
        let anchor = rangeAnchorRef.current;
        if (!listModels.includes(anchor)) {
            anchor = selectedModelArray.length === 1 ? selectedModelArray[0] : null;
        }
        if (event.shiftKey && anchor && model.visible !== false) {
            const from = listModels.indexOf(anchor);
            const to = listModels.indexOf(model);
            const range = listModels
                .slice(Math.min(from, to), Math.max(from, to) + 1)
                .filter(item => item.visible !== false);
            dispatch(editorActions.selectModels(headType, range));
            return;
        }

        rangeAnchorRef.current = model;
        dispatch(editorActions.selectTargetModel(headType, model, isMultiSelect));
    }, [dispatch, headType, models, selectedModelArray]);

    // Drag a row by its name to change the order. The list order is the laser
    // order inside a tool path and the stack on the canvas, first at the bottom.
    const scrollRef = useRef<HTMLDivElement>(null);
    const rowsRef = useRef<HTMLDivElement>(null);
    const rowDragRef = useRef<RowDrag | null>(null);
    const [dropMark, setDropMark] = useState<DropMark | null>(null);

    const onRowPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
        const target = event.target as HTMLElement;
        const row = target.closest<HTMLElement>('[data-model-id]');
        // Only the name part starts a drag; the lock and the eye stay buttons.
        if (event.button !== 0 || inProgress || !row || !target.closest('a')) {
            return;
        }
        const model = models.find((item) => item.modelID === row.dataset.modelId);
        if (model) {
            rowDragRef.current = { model, pointerId: event.pointerId, startY: event.clientY, active: false };
        }
    };

    const onRowPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
        const drag = rowDragRef.current;
        if (!drag || drag.pointerId !== event.pointerId) {
            return;
        }
        if (!drag.active) {
            if (Math.abs(event.clientY - drag.startY) < DRAG_START_DISTANCE) {
                return;
            }
            drag.active = true;
            // From here on the rows do not get the click, so the selection stays.
            event.currentTarget.setPointerCapture(event.pointerId);
        }
        const scrollElement = scrollRef.current;
        const box = scrollElement.getBoundingClientRect();
        if (event.clientY < box.top + DRAG_SCROLL_EDGE) {
            scrollElement.scrollTop -= DRAG_SCROLL_STEP;
        } else if (event.clientY > box.bottom - DRAG_SCROLL_EDGE) {
            scrollElement.scrollTop += DRAG_SCROLL_STEP;
        }
        setDropMark(dropMarkAt(rowsRef.current, event.clientY));
    };

    const onRowPointerEnd = (event: React.PointerEvent<HTMLDivElement>) => {
        const drag = rowDragRef.current;
        if (!drag || drag.pointerId !== event.pointerId) {
            return;
        }
        rowDragRef.current = null;
        setDropMark(null);
        if (!drag.active) {
            return;
        }
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
        }
        if (event.type === 'pointerup') {
            const { index } = dropMarkAt(rowsRef.current, event.clientY);
            dispatch(editorActions.moveModelInList(headType, drag.model, index));
        }
    };

    const actions = {
        onClickModelHideBox(model) {
            const visible = model.visible;
            dispatch(editorActions.selectTargetModel(headType, model));
            if (visible) {
                dispatch(editorActions.hideSelectedModel(headType, model));
            } else {
                dispatch(editorActions.showSelectedModel(headType, model));
            }
        },
        onClickModelLockBox(model) {
            dispatch(editorActions.setModelLocked(headType, model, !model.locked));
        }
    };

    useEffect(() => {
        if (previewFailed) {
            modal({
                title: i18n._('key-unused-Failed to preview'),
                body: i18n._('key-unused-Failed to preview, please modify parameters and try again.')
            });
        }
    }, [previewFailed]);
    const allModels = (models) && models.filter(model => !model.supportTag);

    const resizeTitle = i18n._('key-CncLaser/ObjectList-Drag to resize. Double-click to reset.');

    return (
        <div
            className={styles['object-list-resizable']}
            style={{ width: shownSize.width }}
        >
            <div
                className={styles['object-list-resize-top']}
                title={resizeTitle}
                onPointerDown={(event) => onResizeStart(event, growUp)}
                onPointerMove={onResizeMove}
                onPointerUp={onResizeEnd}
                onPointerCancel={onResizeEnd}
                onDoubleClick={onResizeReset}
            />
            <div
                className={styles['object-list-resize-corner']}
                title={resizeTitle}
                onPointerDown={(event) => onResizeStart(event, growUpAndRight)}
                onPointerMove={onResizeMove}
                onPointerUp={onResizeEnd}
                onPointerCancel={onResizeEnd}
                onDoubleClick={onResizeReset}
            />
            <div
                ref={scrollRef}
                className={styles['object-list-box']}
                style={{ maxHeight: shownSize.height }}
            >
                <div
                    ref={rowsRef}
                    className={classNames('padding-vertical-4', styles['object-list-rows'], { [styles.dragging]: !!dropMark })}
                    onPointerDown={onRowPointerDown}
                    onPointerMove={onRowPointerMove}
                    onPointerUp={onRowPointerEnd}
                    onPointerCancel={onRowPointerEnd}
                >
                    {dropMark && (
                        <div className={styles['object-list-drop-line']} style={{ top: dropMark.top }} />
                    )}
                    {
                        allModels && allModels.map((model) => {
                            return (
                                <ModelItem
                                    model={model}
                                    key={model.modelID}
                                    visible={model.visible}
                                    styles={styles}
                                    isSelected={selectedModelArray && selectedModelArray.includes(model)}
                                    onSelect={onSelectItem}
                                    onToggleVisible={actions.onClickModelHideBox}
                                    locked={model.locked}
                                    onToggleLocked={actions.onClickModelLockBox}
                                    inProgress={inProgress}
                                    placement="right"
                                />
                            );
                        })
                    }
                    {
                        allModels && allModels.length === 0 && (
                            <div className="padding-vertical-4 padding-horizontal-8">
                                <div className="height-24">
                                    <span>{i18n._('key-Printing/No model(s).')}</span>
                                </div>
                            </div>
                        )
                    }
                </div>
            </div>
        </div>
    );
};

export default ObjectListBox;
