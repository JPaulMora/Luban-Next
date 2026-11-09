import classNames from 'classnames';
import PropTypes from 'prop-types';
import React, { useState } from 'react';
import i18n from '../../../../lib/i18n';
import { normalizeNameDisplay } from '../../../../lib/normalize-range';
import Anchor from '../../../components/Anchor';
import SvgIcon from '../../../components/SvgIcon';
import TipTrigger from '../../../components/TipTrigger';

let svgName = '';
let modelName = '';
const objectListShape = 'ObjectListShape';
const objectListPicture = 'ObjectListPicture';

const ModelIcon = (props) => {
    const { model, disabled, name } = props;
    return (
        <SvgIcon
            type={['static']}
            color={model.needRepair ? '#FFA940' : ''}
            name={model.needRepair ? 'WarningTipsWarningBig' : name}
            className="margin-right-4"
            disabled={disabled}
        />
    );
};

ModelIcon.propTypes = {
    model: PropTypes.object.isRequired,
    disabled: PropTypes.bool.isRequired,
    name: PropTypes.string.isRequired,
};

function ModelItem(
    {
        model, visible, isSelected, styles, onSelect, onToggleVisible,
        locked = false, onToggleLocked,
        inProgress, placement, disabled = false,
    }
) {
    const [tipVisible, setTipVisible] = useState(false);

    if (!model) {
        return null;
    }

    const taskInfo = model.getTaskInfo();
    modelName = taskInfo.modelName;
    svgName = (() => {
        if (taskInfo.sourceType === 'text') {
            return objectListShape;
        }
        if (taskInfo.mode !== 'vector') {
            return objectListPicture;
        }
        return objectListShape;
    })();
    const suffixLength = 7;
    const { prefixName, suffixName } = normalizeNameDisplay(modelName, suffixLength);

    const hasChildren = model.children && !!model.children?.length;

    return (
        <div>
            <TipTrigger
                key={model.modelID}
                title={i18n._('key-PrintingCncLaser/ObjectList-Object')}
                content={model.modelName}
                placement={placement || undefined}
                visible={!hasChildren && tipVisible}
            >
                <div
                    className={classNames(
                        // 'padding-vertical-4',
                        // 'padding-horizontal-8',
                        'sm-flex',
                        styles['object-list-item'],
                        {
                            [styles.selected]: isSelected,
                        },
                    )}
                >
                    <Anchor
                        className={classNames(
                            'height-24',
                            'sm-flex-width',
                            'margin-left-8',
                            'sm-flex',
                        )}
                        style={{ color: disabled ? '#D5D6D9' : '' }}
                        onClick={(event) => onSelect(model, event)}
                        onMouseEnter={() => {
                            setTipVisible(true);
                        }}
                        onMouseLeave={() => {
                            setTipVisible(false);
                        }}
                    >

                        <ModelIcon name={svgName} model={model} disabled={disabled} />

                        <span className={classNames(styles['prefix-name'])}>
                            {prefixName}
                        </span>
                        <span className={classNames(styles['suffix-name'])}>
                            {suffixName}
                        </span>
                    </Anchor>
                    {onToggleLocked && (
                        <SvgIcon
                            name={locked ? 'LockNormal' : 'UnlockNormal'}
                            title={locked ? i18n._('key-PrintingCncLaser/ObjectList-Unlock') : i18n._('key-PrintingCncLaser/ObjectList-Lock')}
                            color={locked ? '#545659' : '#B9BCBF'}
                            onClick={() => onToggleLocked(model)}
                            disabled={inProgress || disabled}
                            type={['static']}
                        />
                    )}
                    <SvgIcon
                        className="margin-right-8"
                        name={visible ? 'ShowNormal' : 'HideNormal'}
                        title={visible ? i18n._('key-PrintingCncLaser/ObjectList-Hide') : i18n._('key-PrintingCncLaser/ObjectList-Show')}
                        color={visible ? '#545659' : '#B9BCBF'}
                        onClick={() => onToggleVisible(model)}
                        disabled={inProgress || disabled}
                        // type={isSelected ? ['static'] : ['hoverNormal', 'pressNormal']}
                        type={['static']}
                    />
                </div>
            </TipTrigger>
        </div>
    );
}

ModelItem.propTypes = {
    model: PropTypes.object.isRequired,
    styles: PropTypes.object.isRequired,
    visible: PropTypes.bool.isRequired,
    isSelected: PropTypes.bool.isRequired,
    onSelect: PropTypes.func.isRequired,
    onToggleVisible: PropTypes.func.isRequired,
    locked: PropTypes.bool,
    onToggleLocked: PropTypes.func,
    inProgress: PropTypes.bool.isRequired,
    disabled: PropTypes.bool,
    placement: PropTypes.string,
};

export default React.memo(ModelItem);
