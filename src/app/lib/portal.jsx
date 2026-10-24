import React from 'react';
import { createRoot } from 'react-dom/client';

export default (Component, node = null) => new Promise((resolve) => {
    let defaultNode = null;

    if (!node) {
        defaultNode = document.createElement('div');
        defaultNode.setAttribute('data-portal', '');
        document && document.body && document.body.appendChild(defaultNode);
    }

    const target = node || defaultNode;
    const root = createRoot(target);

    root.render(
        <Component
            onClose={() => {
                setTimeout(() => {
                    root.unmount();
                    if (!node && defaultNode) {
                        document && document.body && document.body.removeChild(defaultNode);
                        defaultNode = null;
                    }

                    resolve();
                }, 0);
            }}
        />
    );
});
