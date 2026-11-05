import React, { useEffect, useRef, useState } from 'react';
import { shallowEqual, useDispatch, useSelector } from 'react-redux';
import { Spin } from 'antd';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import STLLoader from '../../../scene/three-extensions/STLLoader';
import { EPS, toFixed } from '../../../lib/numeric-utils';
import { NumberInput as Input } from '../../components/Input';
import Select from '../../components/Select';
import i18n from '../../../lib/i18n';
import styles from './styles.styl';
import { HEAD_LASER, DATA_PREFIX } from '../../../constants';
import { actions as editorActions } from '../../../flux/editor';
import { actions as menuActions } from '../../../flux/appbar-menu';
import { limitsForUpAxis, upAxisName } from '../../../../shared/lib/stackedModel';
import ModelViewer from './Canvas';

let scale = 1, canvasRange = {};
const MAX_Z = 500, MIN_SIZE = 0.1, MAX_THICKNESS = 50, DEFAULT_THICKNESS = 1.5;
const MAX_LAYER_COUNT = 999;
const UP_AXIS_OPTIONS = [
    { value: 'z', label: '+Z' },
    { value: '-z', label: '-Z' },
    { value: 'y', label: '+Y' },
    { value: '-y', label: '-Y' },
    { value: 'x', label: '+X' },
    { value: '-x', label: '-X' }
];

const StackedModel = ({ setStackedModelModalDsiabled }) => {
    const { isProcessing = false, svgInfo, stlInfo, modelInitSize, initScale } = useSelector(state => state[HEAD_LASER].cutModelInfo);
    const coordinateSize = useSelector(state => state[HEAD_LASER].coordinateSize, shallowEqual);
    const [disabled, setDisabled] = useState(false);
    const [size, setSize] = useState(modelInitSize);
    const [cuttingModel, setCuttingModel] = useState(false);
    const [modelGeometry, setModelGeometry] = useState(null);
    const [thickness, setThickness] = useState(DEFAULT_THICKNESS);
    const [upAxis, setUpAxis] = useState('z');
    const [modelOffset, setModelOffset] = useState(0);
    const [layersOn, setLayersOn] = useState(1);
    const [layersOff, setLayersOff] = useState(0);
    const dispatch = useDispatch();
    const cutKey = useRef('');
    const axisLimit = limitsForUpAxis(upAxis, coordinateSize.x, coordinateSize.y, MAX_Z);
    const stackHeight = size[upAxisName(upAxis)] || 0;

    function maxDisplayedRatio(axis) {
        const limits = limitsForUpAxis(axis, coordinateSize.x, coordinateSize.y, MAX_Z);
        return Math.min(
            limits.x / modelInitSize.x,
            limits.y / modelInitSize.y,
            limits.z / modelInitSize.z
        );
    }

    function applyDisplayedRatio(axis, ratio) {
        const displayedRatio = Math.min(maxDisplayedRatio(axis), ratio);
        const nextScale = initScale * displayedRatio;
        const nextSize = {
            x: modelInitSize.x * displayedRatio,
            y: modelInitSize.y * displayedRatio,
            z: modelInitSize.z * displayedRatio
        };
        if (Math.abs(scale - nextScale) > EPS) {
            scale = nextScale;
            setSize(nextSize);
        }
        const height = nextSize[upAxisName(axis)];
        if (modelOffset > height) {
            setModelOffset(height);
        }
    }

    const actions = {
        loadModel: () => {
            // load cutted model
            if (!stlInfo) return;
            new STLLoader().load(
                `${DATA_PREFIX}/${stlInfo.filename}`,
                (geometry) => {
                    geometry.computeBoundingBox();
                    const box3 = geometry.boundingBox;
                    const x = -(box3.max.x + box3.min.x) / 2;
                    const y = -(box3.max.y + box3.min.y) / 2;
                    const z = -(box3.max.z + box3.min.z) / 2;
                    geometry.translate(x, y, z);
                    geometry.scale(1, -1, 1);
                    setModelGeometry(geometry);
                    setCuttingModel(false);
                },
                () => {},
                () => {
                    setCuttingModel(false);
                }
            );
        },
        generateModelStack: () => {
            setCuttingModel(true);
            dispatch(editorActions.generateModelStack(
                HEAD_LASER,
                size.x,
                size.y,
                thickness,
                scale,
                {
                    upAxis,
                    modelOffset,
                    layersOn,
                    layersOff
                }
            ));
        },
        onChangeLogicalX: (value) => {
            if (value !== toFixed(size.x, 1)) {
                applyDisplayedRatio(upAxis, value / modelInitSize.x);
            }
        },
        onChangeLogicalY: (value) => {
            if (value !== toFixed(size.y, 1)) {
                applyDisplayedRatio(upAxis, value / modelInitSize.y);
            }
        },
        onChangeLogicalZ: (value) => {
            if (value !== toFixed(size.z, 1)) {
                applyDisplayedRatio(upAxis, value / modelInitSize.z);
            }
        },
        onChangeUpAxis: (value) => {
            if (!value || value === upAxis) {
                return;
            }
            const currentRatio = initScale ? scale / initScale : 1;
            applyDisplayedRatio(value, currentRatio);
            setUpAxis(value);
        },
        onChangeMaterialThick: (value) => {
            if (value !== thickness) {
                setThickness(value);
            }
        },
        onChangeModelOffset: (value) => {
            if (value !== modelOffset) {
                setModelOffset(value);
            }
        },
        onChangeLayersOn: (value) => {
            const next = Math.max(1, Math.round(value));
            if (next !== layersOn) {
                setLayersOn(next);
            }
        },
        onChangeLayersOff: (value) => {
            const next = Math.max(0, Math.round(value));
            if (next !== layersOff) {
                setLayersOff(next);
            }
        }
    };
    useEffect(() => {
        dispatch(editorActions.setShortcutStatus(HEAD_LASER, false));
        dispatch(menuActions.disableMenu());
        canvasRange = { x: coordinateSize.x, y: coordinateSize.y, z: MAX_Z };
        scale = initScale;

        return () => {
            dispatch(editorActions.setShortcutStatus(HEAD_LASER, true));
            dispatch(menuActions.enableMenu());
        };
    }, []);
    useEffect(() => {
        setDisabled(isProcessing);
        setStackedModelModalDsiabled(isProcessing || !(svgInfo && svgInfo.length));
    }, [isProcessing, svgInfo]);
    useEffect(() => {
        if (!(size.x && size.y && size.z && thickness && layersOn >= 1) || cuttingModel) {
            return;
        }
        const key = [
            size.x, size.y, size.z, thickness, upAxis, modelOffset, layersOn, layersOff
        ].join(':');
        if (cutKey.current === key) {
            return;
        }
        cutKey.current = key;
        actions.generateModelStack();
    }, [size, thickness, upAxis, modelOffset, layersOn, layersOff, cuttingModel]);
    useEffect(() => {
        if (stlInfo && stlInfo.filename && cuttingModel) {
            actions.loadModel();
        }
    }, [stlInfo]);
    return (
        <div className={classNames(styles['model-cut-modal'])}>
            <div className={classNames(styles['model-cut-modal-left'], 'display-inline')}>
                <Spin spinning={disabled} className={classNames(styles.spin)} tip={i18n._('key-StackedModel/Import-Loading')}>
                    <div className={classNames(styles['model-viewer-container'])}>
                        <ModelViewer geometry={modelGeometry} coordinateSize={canvasRange} />
                    </div>
                </Spin>
                <div className={classNames('margin-top-8', 'text-center', styles.description)} style={{ visibility: disabled ? 'hidden' : 'visible' }}>
                    <span>{i18n._('key-StackedModel/Import-Layers')} </span>
                    <span>{stlInfo?.layers}</span>
                    <span className={classNames(styles['desc-split'])}>|</span>
                    <span>{i18n._('key-StackedModel/Import-Sheets')} </span>
                    <span>{svgInfo?.length}</span>
                </div>
            </div>
            <div className={classNames(styles['model-size-container'])}>
                <div>
                    <div className={classNames(styles.title)}>{i18n._('key-StackedModel/Import-Up Axis')}</div>
                    <div className="sm-flex height-32 margin-vertical-16">
                        <Select
                            disabled={disabled}
                            size="large"
                            showSearch={false}
                            options={UP_AXIS_OPTIONS}
                            value={upAxis}
                            onChange={(option) => {
                                actions.onChangeUpAxis(option && option.value);
                            }}
                        />
                    </div>
                </div>
                <div>
                    <div className={classNames(styles.title, styles.thickness)}>{i18n._('key-StackedModel/Import-Model Size')}</div>
                    <div className="sm-flex height-32 margin-vertical-16">
                        <span className="sm-flex-width sm-flex justify-space-between">
                            <div className="position-re sm-flex align-flex-start">
                                <span className="width-16 height-32 display-inline unit-text align-c margin-left-4 margin-right-4">
                                    X
                                </span>
                                <span>
                                    <Input
                                        suffix="mm"
                                        className="margin-horizontal-2"
                                        disabled={disabled}
                                        value={toFixed(size.x, 1)}
                                        size="large"
                                        min={MIN_SIZE}
                                        max={axisLimit.x}
                                        onChange={(value) => {
                                            actions.onChangeLogicalX(value);
                                        }}
                                    />
                                </span>
                            </div>
                        </span>
                    </div>
                    <div className="sm-flex height-32 margin-vertical-16">
                        <span className="sm-flex-width sm-flex justify-space-between">
                            <div className="position-re sm-flex align-flex-start">
                                <span className="width-16 height-32 display-inline unit-text align-c margin-left-4 margin-right-4">
                                    Y
                                </span>
                                <span>
                                    <Input
                                        suffix="mm"
                                        disabled={disabled}
                                        className="margin-horizontal-2"
                                        value={toFixed(size.y, 1)}
                                        size="large"
                                        min={MIN_SIZE}
                                        max={axisLimit.y}
                                        onChange={(value) => {
                                            actions.onChangeLogicalY(value);
                                        }}
                                    />
                                </span>
                            </div>
                        </span>
                    </div>
                    <div className="sm-flex height-32 margin-vertical-16">
                        <span className="sm-flex-width sm-flex justify-space-between">
                            <div className="position-re sm-flex align-flex-start">
                                <span className="width-16 height-32 display-inline unit-text align-c margin-left-4 margin-right-4">
                                    Z
                                </span>
                                <span>
                                    <Input
                                        suffix="mm"
                                        disabled={disabled}
                                        className="margin-horizontal-2"
                                        value={toFixed(size.z, 1)}
                                        size="large"
                                        min={MIN_SIZE}
                                        max={axisLimit.z}
                                        onChange={(value) => {
                                            actions.onChangeLogicalZ(value);
                                        }}
                                    />
                                </span>
                            </div>
                        </span>
                    </div>
                </div>
                <div>
                    <div className={classNames(styles.title, styles.thickness)}>{i18n._('key-StackedModel/Import-Material Thickness')}</div>
                    <div className="sm-flex height-32 margin-vertical-16">
                        <span className="sm-flex-width sm-flex justify-space-between">
                            <div className="position-re sm-flex align-flex-start">
                                <span className="width-16 height-32 display-inline unit-text align-c margin-left-4 margin-right-4">
                                    T
                                </span>
                                <span>
                                    <Input
                                        suffix="mm"
                                        disabled={disabled}
                                        className="margin-horizontal-2"
                                        value={toFixed(thickness, 1)}
                                        size="large"
                                        min={MIN_SIZE}
                                        max={MAX_THICKNESS}
                                        onChange={(value) => {
                                            actions.onChangeMaterialThick(value);
                                        }}
                                    />
                                </span>
                            </div>
                        </span>
                    </div>
                </div>
                <div>
                    <div className={classNames(styles.title, styles.thickness)}>{i18n._('key-StackedModel/Import-Model Offset')}</div>
                    <div className={classNames(styles.hint)}>{i18n._('key-StackedModel/Import-Model Offset Hint')}</div>
                    <div className="sm-flex height-32 margin-vertical-16">
                        <span className="sm-flex-width sm-flex justify-space-between">
                            <div className="position-re sm-flex align-flex-start">
                                <span className="width-16 height-32 display-inline unit-text align-c margin-left-4 margin-right-4">
                                    O
                                </span>
                                <span>
                                    <Input
                                        suffix="mm"
                                        disabled={disabled}
                                        className="margin-horizontal-2"
                                        value={toFixed(modelOffset, 1)}
                                        size="large"
                                        min={0}
                                        max={stackHeight}
                                        onChange={(value) => {
                                            actions.onChangeModelOffset(value);
                                        }}
                                    />
                                </span>
                            </div>
                        </span>
                    </div>
                </div>
                <div>
                    <div className={classNames(styles.title, styles.thickness)}>{i18n._('key-StackedModel/Import-Layers On')}</div>
                    <div className="sm-flex height-32 margin-vertical-16">
                        <span className="sm-flex-width sm-flex justify-space-between">
                            <div className="position-re sm-flex align-flex-start">
                                <span className="width-16 height-32 display-inline unit-text align-c margin-left-4 margin-right-4" />
                                <span>
                                    <Input
                                        disabled={disabled}
                                        className="margin-horizontal-2"
                                        value={layersOn}
                                        size="large"
                                        min={1}
                                        max={MAX_LAYER_COUNT}
                                        decimalPlaces={0}
                                        onChange={(value) => {
                                            actions.onChangeLayersOn(value);
                                        }}
                                    />
                                </span>
                            </div>
                        </span>
                    </div>
                    <div className={classNames(styles.title)}>{i18n._('key-StackedModel/Import-Layers Off')}</div>
                    <div className="sm-flex height-32 margin-vertical-16">
                        <span className="sm-flex-width sm-flex justify-space-between">
                            <div className="position-re sm-flex align-flex-start">
                                <span className="width-16 height-32 display-inline unit-text align-c margin-left-4 margin-right-4" />
                                <span>
                                    <Input
                                        disabled={disabled}
                                        className="margin-horizontal-2"
                                        value={layersOff}
                                        size="large"
                                        min={0}
                                        max={MAX_LAYER_COUNT}
                                        decimalPlaces={0}
                                        onChange={(value) => {
                                            actions.onChangeLayersOff(value);
                                        }}
                                    />
                                </span>
                            </div>
                        </span>
                    </div>
                    <div className={classNames(styles.hint, 'margin-bottom-16')}>{i18n._('key-StackedModel/Import-Layers Pattern')}</div>
                </div>
            </div>
        </div>
    );
};
StackedModel.propTypes = {
    setStackedModelModalDsiabled: PropTypes.func.isRequired
};

export default StackedModel;
