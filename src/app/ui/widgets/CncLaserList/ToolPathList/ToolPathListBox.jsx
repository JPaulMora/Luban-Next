import React, { useState, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import { useSelector, useDispatch, shallowEqual } from 'react-redux';
import classNames from 'classnames';
import { InputNumber } from 'antd';
// import { cloneDeep, isNull } from 'lodash';
import SvgIcon from '../../../components/SvgIcon';
import Anchor from '../../../components/Anchor';
import { Button } from '../../../components/Buttons';
import styles from '../styles.styl';
import { actions as editorActions } from '../../../../flux/editor';
// import modal from '../../../lib/modal';
import i18n from '../../../../lib/i18n';
// import { toHump } from '../../../../../shared/lib/utils';
import { normalizeNameDisplay } from '../../../../lib/normalize-range';
import TipTrigger from '../../../components/TipTrigger';
import ToolPathConfigurations from '../../../views/ToolPathConfigurations/ToolPathConfigurations';
import ToolPathFastConfigurations from '../../../views/ToolPathConfigurations/ToolPathFastConfigurations';

import {
    PAGE_EDITOR,
    PAGE_PROCESS,
    DISPLAYED_TYPE_TOOLPATH,
    HEAD_CNC,
    HEAD_LASER
} from '../../../../constants';
import ContextMenu from '../../../components/ContextMenu';
import { getModelColorPalette } from '../../../../toolpaths/utils';
import { sameToolpathLineColor, toolpathLineColorCss, toolpathLinePalette } from '../../../../toolpaths/toolpathColors';
import { ColorSwatchChips } from '../../../views/ToolPathConfigurations/laser/ColorSwatches';
import Popover from '../../../components/Popover';
import {
    cncToolsDiffer,
    resolveToolChangeZOffset,
} from '../../../../../shared/lib/cncToolChange';
import useListResize from '../useListResize';

// Height of the tool path list, shared by laser and CNC and kept in editor.json.
const LIST_SIZE_STORE_KEY = 'toolPathListSize';
const DEFAULT_LIST_SIZE = { height: 176 };
const MIN_LIST_HEIGHT = 96;
// Vertical padding of the list card (padding-vertical-4).
const LIST_PADDING = 8;

const clampListSize = (size) => {
    const maxHeight = Math.max(MIN_LIST_HEIGHT, Math.round(window.innerHeight * 0.6));
    const height = Number(size?.height) || DEFAULT_LIST_SIZE.height;
    return { height: Math.round(Math.min(Math.max(height, MIN_LIST_HEIGHT), maxHeight)) };
};

// The list sits above its buttons, so it grows down.
const growDown = (size, dx, dy) => ({ height: size.height + dy });


function PreviewColorSwatch({ color, onChange }) {
    const [open, setOpen] = useState(false);
    return (
        <Popover
            visible={open}
            trigger="click"
            placement="bottomLeft"
            title={i18n._('Toolpath color')}
            onVisibleChange={setOpen}
            content={(
                <div style={{ display: 'flex', flexWrap: 'wrap', width: 120 }}>
                    {toolpathLinePalette().map((entry) => {
                        const selected = sameToolpathLineColor(entry, color);
                        const key = `${entry[0]}-${entry[1]}-${entry[2]}`;
                        return (
                            <span
                                key={key}
                                role="button"
                                tabIndex={0}
                                onClick={(event) => {
                                    event.stopPropagation();
                                    onChange(entry);
                                    setOpen(false);
                                }}
                                onKeyDown={(event) => {
                                    if (event.key === 'Enter' || event.key === ' ') {
                                        event.preventDefault();
                                        event.stopPropagation();
                                        onChange(entry);
                                        setOpen(false);
                                    }
                                }}
                                style={{
                                    display: 'inline-block',
                                    width: 18,
                                    height: 18,
                                    margin: 4,
                                    borderRadius: 2,
                                    background: toolpathLineColorCss(entry),
                                    border: selected ? '2px solid #2A2C2E' : '1px solid #B9BCBF',
                                    boxSizing: 'border-box',
                                    cursor: 'pointer'
                                }}
                            />
                        );
                    })}
                </div>
            )}
        >
            <span
                role="button"
                tabIndex={0}
                title={i18n._('Toolpath color')}
                onClick={(event) => event.stopPropagation()}
                onMouseUp={(event) => event.stopPropagation()}
                onKeyDown={(event) => {
                    event.stopPropagation();
                    if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        setOpen(!open);
                    }
                }}
                style={{
                    display: 'inline-block',
                    width: 12,
                    height: 12,
                    borderRadius: 2,
                    background: toolpathLineColorCss(color),
                    border: '1px solid #B9BCBF',
                    marginRight: 8,
                    flexShrink: 0,
                    alignSelf: 'center',
                    cursor: 'pointer'
                }}
            />
        </Popover>
    );
}
PreviewColorSwatch.propTypes = {
    color: PropTypes.array.isRequired,
    onChange: PropTypes.func.isRequired
};

function toolDefinitionLabel(toolParams) {
    const name = toolParams?.definitionName;
    if (typeof name === 'string' && name.trim().length > 0) {
        return name.trim();
    }
    return '';
}

function countsForToolChange(toolPath) {
    return Boolean(
        toolPath
        && toolPath.visible
        && Array.isArray(toolPath.visibleModelIDs)
        && toolPath.visibleModelIDs.length > 0
    );
}

const ToolChangeRow = ({
    previousToolPath, nextToolPath, isRotate, disabled, onChangeOffset
}) => {
    const fromName = toolDefinitionLabel(previousToolPath.toolParams) || previousToolPath.name;
    const toName = toolDefinitionLabel(nextToolPath.toolParams) || nextToolPath.name;
    const offset = resolveToolChangeZOffset(nextToolPath.toolParams);

    return (
        <div
            className={classNames(styles['tool-change-row'], 'sm-flex', 'justify-space-between', 'align-center')}
            onClick={(event) => event.stopPropagation()}
            onMouseUp={(event) => event.stopPropagation()}
            role="presentation"
        >
            <div className={classNames(styles['tool-change-copy'], 'sm-flex-width')}>
                <div className={styles['tool-change-title']}>
                    {i18n._('key-CncLaser/ToolPathList/ToolChange-Title')}
                </div>
                <div className={styles['tool-change-tools']} title={`${fromName} → ${toName}`}>
                    {`${fromName} → ${toName}`}
                </div>
                {isRotate && (
                    <div className={styles['tool-change-warning']}>
                        {i18n._('key-CncLaser/ToolPathList/ToolChange-Unavailable Rotary')}
                    </div>
                )}
            </div>
            <TipTrigger
                title={i18n._('key-CncLaser/ToolPathList/ToolChange-Z Offset (mm)')}
                content={i18n._('key-CncLaser/ToolPathList/ToolChange-Offset Tooltip')}
                placement="left"
            >
                <div className={classNames('sm-flex', 'align-center', styles['tool-change-offset'])}>
                    <span className={styles['tool-change-offset-label']}>
                        {i18n._('key-CncLaser/ToolPathList/ToolChange-Z Offset (mm)')}
                    </span>
                    <InputNumber
                        size="small"
                        step={0.1}
                        value={offset}
                        disabled={disabled || isRotate}
                        controls={false}
                        onChange={(value) => {
                            if (value === null || value === undefined || Number.isNaN(Number(value))) {
                                onChangeOffset(nextToolPath.id, 0);
                                return;
                            }
                            onChangeOffset(nextToolPath.id, Number(value));
                        }}
                    />
                </div>
            </TipTrigger>
        </div>
    );
};
ToolChangeRow.propTypes = {
    previousToolPath: PropTypes.object.isRequired,
    nextToolPath: PropTypes.object.isRequired,
    isRotate: PropTypes.bool.isRequired,
    disabled: PropTypes.bool.isRequired,
    onChangeOffset: PropTypes.func.isRequired
};

const ToolpathItem = ({
    toolPath, selectedToolPathIDArray, selectToolPathId, selectOneToolPathId, selectToolPathById,
    onClickVisible, setEditingToolpath, disabled, showContextMenu, onSetPreviewColor, showToolName
}) => {
    if (!toolPath) {
        return null;
    }
    function handleOnDoubleClick(e) {
        e.stopPropagation();
        setEditingToolpath(toolPath);
        selectToolPathById(toolPath.id);
    }
    function handleOnClick(e) {
        e.stopPropagation();
        if (e.detail > 1) { // Check difference to double click
            return;
        }
        if (e.shiftKey) {
            selectToolPathId(toolPath.id);
        } else {
            selectOneToolPathId(toolPath.id);
        }
    }
    function handleOnClickVisible(e) {
        e.stopPropagation();
        onClickVisible(toolPath.id, toolPath.visible, toolPath.check);
    }
    const suffixLength = 6;
    const { prefixName, suffixName } = normalizeNameDisplay(toolPath.name, suffixLength);
    const toolName = showToolName ? toolDefinitionLabel(toolPath.toolParams) : '';
    const tipContent = toolName ? (
        <div>
            <div>{toolPath.name}</div>
            <div>{toolName}</div>
        </div>
    ) : toolPath.name;

    return (
        <TipTrigger
            key={toolPath.id}
            title={i18n._('key-CncLaser/ToolPathList/Button/-Object')}
            content={tipContent}
        >
            <div
                className={classNames(
                    styles['object-list-item'],
                    'sm-flex',
                    'justify-space-between',
                    selectedToolPathIDArray.includes(toolPath.id) ? styles.selected : null
                )}
                role="button"
                tabIndex="0"
                onMouseUp={(e) => {
                    if (e.button === 2) { // right click
                        // item is selected, do not select again
                        if (!(selectedToolPathIDArray.length === 1 && selectedToolPathIDArray[0] === toolPath.id)) {
                            selectOneToolPathId(toolPath.id);
                        }
                        e.persist();
                        showContextMenu(e);
                    }
                }}
            >
                <Anchor
                    className={classNames(
                        toolName ? styles['toolpath-main'] : 'height-24',
                        'width-254',
                        'align-l',
                        'sm-flex',
                        'align-center',
                        'sm-flex-width',
                        'margin-left-16',
                        'margin-right-16',
                    )}
                    onDoubleClick={handleOnDoubleClick}
                    onClick={handleOnClick}
                >
                    {toolPath.previewColor && (
                        <PreviewColorSwatch
                            color={toolPath.previewColor}
                            onChange={(color) => onSetPreviewColor(toolPath.id, color)}
                        />
                    )}
                    <span className={classNames(styles['toolpath-labels'], 'sm-flex-width')}>
                        <span className={classNames(styles['prefix-name'])}>
                            {prefixName}
                        </span>
                        <span className={classNames(styles['suffix-name'])}>
                            {suffixName}
                        </span>
                        {toolName && (
                            <span className={styles['tool-name']} title={toolName}>
                                {toolName}
                            </span>
                        )}
                    </span>
                    <ColorSwatchChips colorFilter={toolPath.colorFilter} />
                </Anchor>
                <div className={classNames('sm-flex', 'height-24', 'margin-right-16')}>
                    <i
                        className={classNames(
                            // ...getIconStatus(toolPath.status)
                        )}
                    />
                    {!toolPath.visible && (
                        <SvgIcon
                            size={24}
                            color="#BFBFBF"
                            name="HideNormal"
                            type={['static']}
                            title={i18n._('key-CncLaser/ToolPathList/Button/-Hide')}
                            onClick={handleOnClickVisible}
                            disabled={disabled}
                        />
                    )}
                    {toolPath.visible && (
                        <SvgIcon
                            type={['static']}
                            size={24}
                            name="ShowNormal"
                            title={i18n._('key-CncLaser/ToolPathList/Button/-Show')}
                            onClick={handleOnClickVisible}
                            disabled={disabled}
                        />
                    )}
                </div>
            </div>
        </TipTrigger>
    );
};
ToolpathItem.propTypes = {
    toolPath: PropTypes.object.isRequired,
    selectedToolPathIDArray: PropTypes.array.isRequired,
    selectToolPathId: PropTypes.func.isRequired,
    selectOneToolPathId: PropTypes.func.isRequired,
    selectToolPathById: PropTypes.func.isRequired,
    onClickVisible: PropTypes.func.isRequired,
    showContextMenu: PropTypes.func.isRequired,

    setEditingToolpath: PropTypes.func.isRequired,
    disabled: PropTypes.bool.isRequired,
    onSetPreviewColor: PropTypes.func.isRequired,
    showToolName: PropTypes.bool
};


const ToolPathListBox = (props) => {
    const isOnABPosition = useSelector(state => state.laser?.isOnABPosition);
    const page = useSelector(state => state[props.headType]?.page);
    const toolPaths = useSelector(state => state[props.headType]?.toolPathGroup?.getToolPaths(), shallowEqual);
    const selectedToolPathIDArray = useSelector(state => state[props.headType]?.toolPathGroup?.selectedToolPathArray, shallowEqual);
    const inProgress = useSelector(state => state[props.headType]?.inProgress);
    const displayedType = useSelector(state => state[props.headType]?.displayedType);
    const selectedModelArray = useSelector(state => state[props.headType]?.modelGroup?.getSelectedModelArray());
    const isRotate = useSelector(state => Boolean(state[props.headType]?.materials?.isRotate));
    const dispatch = useDispatch();
    const isCnc = props.headType === HEAD_CNC;

    const selectedColorPalette = props.headType === HEAD_LASER
        && selectedModelArray
        && selectedModelArray.length === 1
        ? getModelColorPalette(selectedModelArray[0])
        : null;
    const contextMenuDisabled = (selectedToolPathIDArray.length !== 1);
    const selectedFirstToolPathId = selectedToolPathIDArray.length === 1 ? selectedToolPathIDArray[0] : null;
    const selectedFirstToolPath = toolPaths.find(d => d.id === selectedFirstToolPathId);
    const [editingToolpath, setEditingToolpath] = useState(null);
    const contextMenuRef = useRef(null);
    const contextMenuArrangementDisabled = (toolPaths.length === 1);
    const {
        size: listSize, onResizeStart, onResizeMove, onResizeEnd, onResizeReset
    } = useListResize(LIST_SIZE_STORE_KEY, DEFAULT_LIST_SIZE, clampListSize);
    const actions = {
        selectOneToolPathId: (id) => {
            dispatch(editorActions.selectOneToolPathId(props.headType, id));
        },
        selectToolPathId: (id) => {
            dispatch(editorActions.selectToolPathId(props.headType, id));
        },
        selectToolPathById: (id) => {
            dispatch(editorActions.selectToolPathById(props.headType, id));
        },
        onClickVisible: (id, visible, check) => {
            dispatch(editorActions.updateToolPath(props.headType, id, {
                visible: !visible,
                check: !check
            }));
            if (displayedType === DISPLAYED_TYPE_TOOLPATH) {
                const hasToolPathVisible = toolPaths.some((toolPath) => {
                    return (toolPath.id === id && !visible) || (toolPath.id !== id && toolPath.visible);
                });
                if (hasToolPathVisible) {
                    dispatch(editorActions.refreshToolPathPreview(props.headType));
                }
            } else {
                dispatch(editorActions.resetProcessState(props.headType));
            }
        },
        deleteToolPath: () => {
            dispatch(editorActions.deleteToolPath(props.headType, selectedToolPathIDArray));
            dispatch(editorActions.refreshToolPathPreview(props.headType));
        },
        commitGenerateToolPath: (toolPathId) => dispatch(editorActions.commitGenerateToolPath(props.headType, toolPathId)),
        toolPathToUp: () => {
            if (selectedFirstToolPathId && toolPaths[0].id !== selectedFirstToolPathId) {
                dispatch(editorActions.toolPathToUp(props.headType, selectedFirstToolPathId));
                dispatch(editorActions.refreshToolPathPreview(props.headType));
            }
        },
        toolPathToDown: () => {
            if (selectedFirstToolPathId && toolPaths[toolPaths.length - 1].id !== selectedFirstToolPathId) {
                dispatch(editorActions.toolPathToDown(props.headType, selectedFirstToolPathId));
                dispatch(editorActions.refreshToolPathPreview(props.headType));
            }
        },
        toolPathToTop: () => {
            if (selectedFirstToolPathId && toolPaths[0].id !== selectedFirstToolPathId) {
                dispatch(editorActions.toolPathToTop(props.headType, selectedFirstToolPathId));
                dispatch(editorActions.refreshToolPathPreview(props.headType));
            }
        },
        toolPathToBottom: () => {
            if (selectedFirstToolPathId && toolPaths[toolPaths.length - 1].id !== selectedFirstToolPathId) {
                dispatch(editorActions.toolPathToBottom(props.headType, selectedFirstToolPathId));
                dispatch(editorActions.refreshToolPathPreview(props.headType));
            }
        },
        createToolPath: () => {
            const toolpath = dispatch(editorActions.createToolPath(props.headType));
            setEditingToolpath(toolpath);
        },
        createToolPathForEachColor: () => {
            dispatch(editorActions.createToolPathForEachColor(props.headType));
        },
        showContextMenu: (event) => {
            setTimeout(() => {
                contextMenuRef.current.show(event);
            }, 0);
        },
        setPreviewColor: (id, color) => {
            dispatch(editorActions.setToolPathPreviewColor(props.headType, id, color));
        },
        updateToolChangeZOffset: (id, toolChangeZOffset) => {
            dispatch(editorActions.updateToolChangeZOffset(props.headType, id, toolChangeZOffset));
        }
    };
    useEffect(() => {
        props.widgetActions.setTitle(i18n._('key-CncLaser/ToolPathList/Button/-Toolpath List'));
    }, []);
    useEffect(() => {
        if (page === PAGE_EDITOR) {
            props.widgetActions.setDisplay(false);
        } else if (page === PAGE_PROCESS) {
            props.widgetActions.setDisplay(true);
        }
    }, [page]);

    return (
        <div className="clearfix">
            <div className={classNames(
                'border-default-grey-1',
                'border-radius-8',
                'margin-top-8'
            )}
            >
                <div
                    className={classNames(
                        'position-re',
                        // // 'align-c',
                        'padding-vertical-4'
                    )}
                    style={{ height: listSize.height + LIST_PADDING }}
                    tabIndex="-1"
                    role="button"
                    onKeyDown={() => { }}
                    onClick={() => {
                        actions.selectToolPathById();
                    }}
                >
                    {toolPaths.length === 0 && (
                        <div className={classNames(
                            // 'font-roboto',
                            'padding-horizontal-16',
                            'sm-flex',
                            'position-absolute',
                            'top-50-percent',
                            'width-percent-100',
                            'justify-center'
                        )}
                        >
                            <SvgIcon
                                name="WarningTipsTips"
                                type={['static']}
                                color="#1890ff"
                            />
                            {/* <SvgIcon
                                name="WarningTipsTips"
                                type={['static']}
                                color="#1890ff"
                            /> */}
                            <span className={classNames('display-inline')}>{i18n._('key-CncLaser/ToolPathList/Button/-Select object to create toolpath')}</span>
                        </div>
                    )}

                    <div
                        className={styles['object-list-box']}
                        style={{ maxHeight: listSize.height }}
                    >
                        {toolPaths && (() => {
                            let previousVisible = null;
                            return toolPaths.map((toolPath) => {
                                const rows = [];
                                const counts = countsForToolChange(toolPath);
                                if (
                                    isCnc
                                    && counts
                                    && previousVisible
                                    && cncToolsDiffer(previousVisible.toolParams, toolPath.toolParams)
                                ) {
                                    rows.push(
                                        <ToolChangeRow
                                            key={`tool-change-${previousVisible.id}-${toolPath.id}`}
                                            previousToolPath={previousVisible}
                                            nextToolPath={toolPath}
                                            isRotate={isRotate}
                                            disabled={isOnABPosition || inProgress}
                                            onChangeOffset={actions.updateToolChangeZOffset}
                                        />
                                    );
                                }
                                if (counts) {
                                    previousVisible = toolPath;
                                }
                                rows.push(
                                    <ToolpathItem
                                        toolPath={toolPath}
                                        key={toolPath.id}
                                        selectedToolPathIDArray={selectedToolPathIDArray}
                                        selectOneToolPathId={actions.selectOneToolPathId}
                                        selectToolPathId={actions.selectToolPathId}
                                        selectToolPathById={actions.selectToolPathById}
                                        onClickVisible={actions.onClickVisible}
                                        setEditingToolpath={setEditingToolpath}
                                        showContextMenu={actions.showContextMenu}
                                        onSetPreviewColor={actions.setPreviewColor}
                                        disabled={isOnABPosition || inProgress}
                                        showToolName={isCnc}
                                    />
                                );
                                return rows;
                            });
                        })()}
                    </div>
                </div>
                {/* Outside the list card, so the click that ends a drag does not clear the selection. */}
                <div
                    className={styles['tool-path-list-resize-bottom']}
                    title={i18n._('key-CncLaser/ObjectList-Drag to resize. Double-click to reset.')}
                    onPointerDown={(event) => onResizeStart(event, growDown)}
                    onPointerMove={onResizeMove}
                    onPointerUp={onResizeEnd}
                    onPointerCancel={onResizeEnd}
                    onDoubleClick={onResizeReset}
                />
                <div className={classNames(
                    'border-radius-bottom-8',
                    'padding-horizontal-16',
                    'module-default-shadow',
                    'padding-bottom-16',
                    'clearfix',
                    // 'height-96',
                    // 'padding-top-8'
                    `${toolPaths.length !== 0 ? 'padding-top-8' : ''}`
                )}
                >
                    <div className={classNames(
                        'float-l',
                        'margin-vertical-4',
                    )}
                    >
                        <SvgIcon
                            name="Delete"
                            disabled={isOnABPosition || selectedToolPathIDArray.length < 1}
                            size={24}
                            title={i18n._('key-CncLaser/ToolPathList/Button/-Delete')}
                            onClick={() => actions.deleteToolPath(selectedFirstToolPathId)}
                        />
                    </div>
                    <div className={classNames(
                        'float-r',
                        'margin-vertical-4',
                    )}
                    >
                        <SvgIcon
                            className={classNames(
                                'margin-horizontal-8',
                            )}
                            disabled={isOnABPosition || selectedToolPathIDArray.length !== 1}
                            title={i18n._('key-CncLaser/ToolPathList/Button/-Prioritize')}
                            onClick={() => actions.toolPathToUp(selectedToolPathIDArray)}
                            name="Prioritize"
                            size={24}
                        />
                        <SvgIcon
                            disabled={isOnABPosition || selectedToolPathIDArray.length !== 1}
                            title={i18n._('key-CncLaser/ToolPathList/Button/-Deprioritize')}
                            onClick={() => actions.toolPathToDown(selectedToolPathIDArray)}
                            name="Deprioritize"
                            size={24}
                        />
                    </div>
                    <Button
                        type="default"
                        priority="level-two"
                        width="100%"
                        onClick={actions.createToolPath}
                        disabled={isOnABPosition || inProgress || (!selectedModelArray || selectedModelArray.length === 0)}
                    >
                        {i18n._('key-CncLaser/ToolPathList/Button/-Create Toolpath')}
                    </Button>
                    {selectedColorPalette && (
                        <Button
                            type="default"
                            priority="level-two"
                            width="100%"
                            className="margin-top-8"
                            onClick={actions.createToolPathForEachColor}
                            disabled={isOnABPosition || inProgress}
                        >
                            {i18n._('key-CncLaser/ToolPathList/Button/-Create Toolpath for Each Color')}
                        </Button>
                    )}
                </div>
            </div>
            <ContextMenu
                id="toolPathListBoxContextmenu"
                ref={contextMenuRef}
                menuItems={
                    [
                        {
                            type: 'item',
                            label: i18n._('key-CncLaser/ToolPathList/Button/-Edit'),
                            disabled: contextMenuDisabled,
                            onClick: () => {
                                setEditingToolpath(selectedFirstToolPath);
                            }
                        },
                        {
                            type: 'item',
                            label: i18n._('key-CncLaser/ToolPathList/Button/-Delete'),
                            disabled: contextMenuDisabled,
                            onClick: () => actions.deleteToolPath(selectedFirstToolPathId)
                        },
                        {
                            type: 'subMenu',
                            label: i18n._('key-CncLaser/ToolPathList/Button/-Sort'),
                            disabled: contextMenuDisabled || contextMenuArrangementDisabled,
                            items: [
                                {
                                    type: 'item',
                                    label: i18n._('key-CncLaser/ToolPathList/Button/-Prioritize'),
                                    disabled: contextMenuDisabled,
                                    onClick: () => actions.toolPathToUp(selectedToolPathIDArray)
                                },
                                {
                                    type: 'item',
                                    label: i18n._('key-CncLaser/ToolPathList/Button/-Deprioritize'),
                                    disabled: contextMenuDisabled,
                                    onClick: () => actions.toolPathToDown(selectedToolPathIDArray)
                                },
                                {
                                    type: 'item',
                                    label: i18n._('key-CncLaser/ToolPathList/Button/-Top'),
                                    disabled: contextMenuDisabled,
                                    onClick: () => actions.toolPathToTop(selectedToolPathIDArray)
                                },
                                {
                                    type: 'item',
                                    label: i18n._('key-CncLaser/ToolPathList/Button/-Bottom'),
                                    disabled: contextMenuDisabled,
                                    onClick: () => actions.toolPathToBottom(selectedToolPathIDArray)
                                }
                            ]
                        }
                    ]
                }
            />
            {!isOnABPosition && editingToolpath && (
                <ToolPathConfigurations
                    headType={props.headType}
                    toolpath={editingToolpath}
                    onClose={() => setEditingToolpath(null)}
                />
            )}
            {!isOnABPosition && selectedFirstToolPath && (
                <ToolPathFastConfigurations
                    headType={props.headType}
                    setEditingToolpath={setEditingToolpath}
                    toolpath={selectedFirstToolPath}
                />
            )}
        </div>
    );
};
ToolPathListBox.propTypes = {
    widgetActions: PropTypes.object.isRequired,
    headType: PropTypes.string
};
export default ToolPathListBox;
