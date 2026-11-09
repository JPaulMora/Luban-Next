import classNames from 'classnames';
import React, { useEffect, useCallback, useRef, useState } from 'react';
import { shallowEqual, useDispatch, useSelector } from 'react-redux';

import { actions as editorActions } from '../../../../flux/editor';
import i18n from '../../../../lib/i18n';
import modal from '../../../../lib/modal';
import { editorStore } from '../../../../store/local-storage';
import styles from '../styles.styl';
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

declare interface ResizeDrag {
    x: number;
    y: number;
    size: ListSize;
    resizeWidth: boolean;
}

const ObjectListBox: React.FC<ObjectListBoxProps> = ({ headType }) => {
    const selectedModelArray = useSelector(state => state[headType].modelGroup?.selectedModelArray);
    const models = useSelector(state => state[headType]?.modelGroup?.models);

    const inProgress = useSelector(state => state[headType]?.inProgress, shallowEqual);
    const previewFailed = useSelector(state => state[headType]?.previewFailed, shallowEqual);

    const dispatch = useDispatch();

    const [size, setSize] = useState<ListSize>(() => clampSize(editorStore.get(SIZE_STORE_KEY, DEFAULT_SIZE)));
    const sizeRef = useRef<ListSize>(size);
    const dragRef = useRef<ResizeDrag | null>(null);

    const updateSize = useCallback((nextSize: ListSize) => {
        sizeRef.current = nextSize;
        setSize(nextSize);
    }, []);

    // The list sits at the bottom left of the canvas, so it grows up and to the right.
    const onResizeStart = useCallback((event: React.PointerEvent<HTMLDivElement>, resizeWidth: boolean) => {
        if (event.button !== 0) {
            return;
        }
        event.preventDefault();
        event.stopPropagation();
        event.currentTarget.setPointerCapture(event.pointerId);
        dragRef.current = { x: event.clientX, y: event.clientY, size: sizeRef.current, resizeWidth };
    }, []);

    const onResizeMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
        const drag = dragRef.current;
        if (!drag) {
            return;
        }
        updateSize(clampSize({
            width: drag.resizeWidth ? drag.size.width + event.clientX - drag.x : drag.size.width,
            height: drag.size.height + drag.y - event.clientY,
        }));
    }, [updateSize]);

    const onResizeEnd = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
        if (!dragRef.current) {
            return;
        }
        dragRef.current = null;
        event.currentTarget.releasePointerCapture(event.pointerId);
        editorStore.set(SIZE_STORE_KEY, sizeRef.current);
    }, []);

    const onResizeReset = useCallback(() => {
        updateSize(clampSize(DEFAULT_SIZE));
        editorStore.set(SIZE_STORE_KEY, DEFAULT_SIZE);
    }, [updateSize]);

    const onSelectItem = useCallback((model, event) => {
        let isMultiSelect = event.shiftKey;

        // TODO: Add comment here
        if (selectedModelArray.length === 1 && selectedModelArray[0].visible === false) {
            isMultiSelect = false;
        }
        // TODO: Add comment here
        if (selectedModelArray.length > 0 && model.visible === false) {
            isMultiSelect = false;
        }

        dispatch(editorActions.selectTargetModel(headType, model, isMultiSelect));
    }, [dispatch, headType, selectedModelArray]);

    const actions = {
        onClickModelHideBox(model) {
            const visible = model.visible;
            dispatch(editorActions.selectTargetModel(headType, model));
            if (visible) {
                dispatch(editorActions.hideSelectedModel(headType, model));
            } else {
                dispatch(editorActions.showSelectedModel(headType, model));
            }
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

    // Clamp again on render in case the window got smaller since the size was saved.
    const shownSize = clampSize(size);
    const resizeTitle = i18n._('key-CncLaser/ObjectList-Drag to resize. Double-click to reset.');

    return (
        <div
            className={styles['object-list-resizable']}
            style={{ width: shownSize.width }}
        >
            <div
                className={styles['object-list-resize-top']}
                title={resizeTitle}
                onPointerDown={(event) => onResizeStart(event, false)}
                onPointerMove={onResizeMove}
                onPointerUp={onResizeEnd}
                onPointerCancel={onResizeEnd}
                onDoubleClick={onResizeReset}
            />
            <div
                className={styles['object-list-resize-corner']}
                title={resizeTitle}
                onPointerDown={(event) => onResizeStart(event, true)}
                onPointerMove={onResizeMove}
                onPointerUp={onResizeEnd}
                onPointerCancel={onResizeEnd}
                onDoubleClick={onResizeReset}
            />
            <div
                className={styles['object-list-box']}
                style={{ maxHeight: shownSize.height }}
            >
                <div className={classNames('padding-vertical-4')}>
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
