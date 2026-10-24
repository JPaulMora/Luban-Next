import React from 'react';
import { createRoot } from 'react-dom/client';

export default (Component, node = null) => new Promise((resolve) => {
    let defaultNode = null;

    if (!node) {
        defaultNode = document.createElement('div');
        defaultNode.setAttribute('data-portal', '');
        document && document.body && document.body.appendChild(defaultNode);
    }

    const mountNode = node || defaultNode;
    const root = createRoot(mountNode);
    mountNode._reactRoot = root;
    root.render(
        <Component
            onClose={() => {
                setTimeout(() => {
                    if (mountNode._reactRoot) {
                        mountNode._reactRoot.unmount();
                        mountNode._reactRoot = null;
                    }
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
