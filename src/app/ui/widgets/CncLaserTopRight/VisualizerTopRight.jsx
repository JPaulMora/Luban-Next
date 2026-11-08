import React, { useEffect } from 'react';
import PropTypes from 'prop-types';
import { useDispatch, useSelector } from 'react-redux';
import classNames from 'classnames';
import i18n from '../../../lib/i18n';
import Checkbox from '../../components/Checkbox';
import { Button } from '../../components/Buttons';

import { HEAD_CNC, DISPLAYED_TYPE_TOOLPATH } from '../../../constants';
import { actions as editorActions } from '../../../flux/editor';
import styles from './styles.styl';

const VisualizerTopRight = ({ headType }) => {
    const displayedType = useSelector(state => state[headType]?.displayedType);
    const showToolPath = useSelector(state => state[headType]?.showToolPath);
    const showSimulation = useSelector(state => state[headType]?.showSimulation);
    const hasSolidSimulation = useSelector(state => state[headType]?.hasSolidSimulation);
    const canGenerateGcode = useSelector(state => state[headType]?.toolPathGroup?.canGenerateGcode());
    const solidSimRunning = useSelector(state => state[headType]?.solidSimRunning);
    const solidSimProgress = useSelector(state => state[headType]?.solidSimProgress) || 0;

    const dispatch = useDispatch();

    const actions = {
        switchToEditPage: () => {
            if (displayedType === DISPLAYED_TYPE_TOOLPATH) {
                dispatch(editorActions.showModelGroupObject(headType));
            } else {
                dispatch(editorActions.showToolPathGroupObject(headType));
            }
        },
        switchShowToolPath: () => {
            dispatch(editorActions.showToolpathInPreview(headType, !showToolPath));
        },
        switchShowSimulation: () => {
            if (!hasSolidSimulation) {
                return;
            }
            dispatch(editorActions.showSimulationInPreview(headType, !showSimulation));
        },
        runSolidSimulation: () => {
            if (!canGenerateGcode || solidSimRunning) {
                return;
            }
            dispatch(editorActions.commitGenerateSolidSimulation(headType));
        },
        cancelSolidSimulation: () => {
            dispatch(editorActions.cancelGenerateSolidSimulation(headType));
        },
    };

    useEffect(() => {
        if (canGenerateGcode === false && hasSolidSimulation) {
            dispatch(editorActions.clearSolidSimulation(headType));
            dispatch(editorActions.resetSimulationPreviewState(headType));
        }
    }, [canGenerateGcode]);

    const progressPercent = Math.max(0, Math.min(100, Math.round((solidSimProgress || 0) * 100)));

    return (
        <React.Fragment>
            <div>
                {headType === HEAD_CNC && (
                    <div
                        className={classNames(
                            styles['visualizer-top-right'],
                            'position-absolute',
                            'right-8',
                            'width-200',
                            'border-default-grey-1',
                            'border-radius-8',
                            'background-color-white',
                        )}
                    >
                        <div className="border-bottom-normal padding-vertical-8 padding-horizontal-16 height-40">
                            {i18n._('key-CncLaser/Preview-Preview Type')}
                        </div>
                        <div className="padding-vertical-16 padding-horizontal-16">
                            <div className="sm-flex justify-space-between height-24">
                                <span>
                                    {i18n._('key-CncLaser/Preview-Toolpath')}
                                </span>
                                <Checkbox
                                    onChange={actions.switchShowToolPath}
                                    checked={showToolPath}
                                />
                            </div>
                            {hasSolidSimulation && (
                                <div className="sm-flex justify-space-between height-24 margin-top-16">
                                    <span>
                                        {i18n._('key-CncLaser/Preview-Simulation')}
                                    </span>
                                    <Checkbox
                                        onChange={actions.switchShowSimulation}
                                        checked={showSimulation}
                                    />
                                </div>
                            )}
                            <div className="border-top-normal margin-top-16 padding-top-16">
                                {!solidSimRunning && (
                                    <Button
                                        type="default"
                                        priority="level-three"
                                        width="100%"
                                        disabled={!canGenerateGcode}
                                        onClick={actions.runSolidSimulation}
                                    >
                                        {i18n._('Simulate')}
                                    </Button>
                                )}
                                {solidSimRunning && (
                                    <div className={styles['solid-sim-loader']}>
                                        <div className="sm-flex justify-space-between align-center">
                                            <span className="font-size-sm">
                                                {i18n._('Simulating…')}
                                                {progressPercent > 0 ? ` ${progressPercent}%` : ''}
                                            </span>
                                        </div>
                                        <div className={styles['solid-sim-progress-track']}>
                                            <div
                                                className={styles['solid-sim-progress-bar']}
                                                style={{ width: `${Math.max(progressPercent, 5)}%` }}
                                            />
                                        </div>
                                        <Button
                                            type="default"
                                            priority="level-three"
                                            width="100%"
                                            className="margin-top-8"
                                            onClick={actions.cancelSolidSimulation}
                                        >
                                            {i18n._('Cancel')}
                                        </Button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </React.Fragment>
    );
};

VisualizerTopRight.propTypes = {
    headType: PropTypes.string.isRequired
};

export default VisualizerTopRight;
