import React from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';

import i18n from '../../../../lib/i18n';
import Checkbox from '../../../components/Checkbox';
import { isSameColorFilterEntry } from '../../../../toolpaths/utils';


const roleLabel = (role) => {
    if (role === 'fill') {
        return i18n._('key-Laser/ToolpathParameters-Fill');
    }
    return i18n._('key-Laser/ToolpathParameters-Stroke');
};

export function ColorSwatchChips({ colorFilter }) {
    if (!colorFilter || colorFilter.length === 0) {
        return null;
    }
    return (
        <span className="sm-flex margin-left-8">
            {colorFilter.slice(0, 6).map((entry) => (
                <span
                    key={`${entry.role}:${entry.hex}`}
                    title={`${roleLabel(entry.role)} ${entry.hex}`}
                    style={{
                        display: 'inline-block',
                        width: 12,
                        height: 12,
                        borderRadius: 2,
                        background: entry.hex,
                        border: '1px solid #B9BCBF',
                        marginRight: 4
                    }}
                />
            ))}
        </span>
    );
}
ColorSwatchChips.propTypes = {
    colorFilter: PropTypes.array
};

function ColorSwatchChecklist({ palette, colorFilter, onChange }) {
    const selected = colorFilter || [];

    const toggle = (swatch, checked) => {
        if (checked) {
            onChange([...selected, { role: swatch.role, hex: swatch.hex }]);
            return;
        }
        onChange(selected.filter(entry => !isSameColorFilterEntry(entry, swatch)));
    };

    return (
        <div className="margin-vertical-8">
            <div className="height-32 sm-flex align-c">
                <span>{i18n._('key-Laser/ToolpathParameters-Colors')}</span>
            </div>
            {palette.map((swatch) => {
                const checked = selected.some(entry => isSameColorFilterEntry(entry, swatch));
                return (
                    <div
                        key={`${swatch.role}:${swatch.hex}`}
                        className={classNames(
                            'sm-flex',
                            'justify-space-between',
                            'align-c',
                            'height-32',
                            'margin-vertical-4'
                        )}
                    >
                        <Checkbox
                            checked={checked}
                            onChange={(event) => {
                                toggle(swatch, event.target.checked);
                            }}
                        >
                            <span
                                style={{
                                    display: 'inline-block',
                                    width: 16,
                                    height: 16,
                                    borderRadius: 2,
                                    background: swatch.hex,
                                    border: '1px solid #B9BCBF',
                                    marginRight: 8,
                                    verticalAlign: 'middle'
                                }}
                            />
                            <span>{`${roleLabel(swatch.role)} ${swatch.hex}`}</span>
                            <span className="margin-left-8">{`(${swatch.count})`}</span>
                        </Checkbox>
                    </div>
                );
            })}
        </div>
    );
}
ColorSwatchChecklist.propTypes = {
    palette: PropTypes.array.isRequired,
    colorFilter: PropTypes.array,
    onChange: PropTypes.func.isRequired
};

export default ColorSwatchChecklist;
