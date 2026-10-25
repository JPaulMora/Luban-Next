import React from 'react';

import modal from '../../../lib/modal';
import i18n from '../../../lib/i18n';
import { Button } from '../../components/Buttons';


const askSvgColorImport = () => {
    return new Promise((resolve) => {
        const action = modal({
            title: i18n._('key-Laser/Import-How should this SVG be imported?'),
            body: (
                <p>
                    {i18n._('key-Laser/Import-This file has more than one color. Choose whether to keep it as one object or create a toolpath for each color.')}
                </p>
            ),
            cancelTitle: 'key-Laser/Import-Import as one object',
            cancelWidth: '180px',
            footer: (
                <Button
                    priority="level-two"
                    type="primary"
                    width="180px"
                    className="margin-left-8"
                    onClick={() => {
                        resolve(true);
                        action.close();
                    }}
                >
                    {i18n._('key-Laser/Import-Process each color')}
                </Button>
            ),
            onClose: () => {
                resolve(false);
            }
        });
    });
};

export default askSvgColorImport;
