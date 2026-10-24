/* eslint react/no-set-state: 0 */
// import pick from 'lodash/pick';
import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import { createRoot } from 'react-dom/client';
import i18n from './i18n';
import Modal from '../ui/components/Modal';

class WarningModalHOC extends PureComponent {
    static propTypes = {
        ...Modal.propTypes,
        container: PropTypes.object,
        root: PropTypes.object,
        title: PropTypes.node,
        body: PropTypes.node,
        insideHideModal: PropTypes.func.isRequired,
        iconSrc: PropTypes.string,
        bodyTitle: PropTypes.string,
        footer: PropTypes.node
    };

    static defaultProps = {
        ...Modal.defaultProps
    };

    state = {
        show: true
    };

    handleClose = () => {
        this.setState({ show: false });
        setTimeout(() => {
            this.removeContainer();
            this.props.onClose();
        });
    };

    handleConfirm = () => {
        this.setState({ show: false });
        setTimeout(() => {
            this.removeContainer();
            this.props.onClose();
        });
        this.props.insideHideModal();
    };

    removeContainer() {
        const { container, root } = this.props;
        root.unmount();
        container.remove();
    }

    render() {
        const { title, bodyTitle, body, footer, size, iconSrc, ...rest } = this.props;
        const { show } = this.state;

        return (
            <Modal
                {...rest}
                size={size || 'sm'}
                show={show}
                onClose={this.handleClose}
            >
                {title && (
                    <Modal.Header>
                        {/* <Modal.Title> */}
                        {title}
                        {/* </Modal.Title> */}
                    </Modal.Header>
                )}
                <Modal.Body>
                    <img
                        style={{ display: 'block', margin: '0 auto' }}
                        src={iconSrc}
                        alt=""
                    />
                    <p style={{ fontWeight: 'blod', margin: '20px 0', textAlign: 'center' }}>
                        {bodyTitle}
                    </p>
                    <div style={{ textAlign: 'center' }}>
                        {body}
                    </div>
                </Modal.Body>
                <Modal.Footer>
                    {footer}
                    <button type="button" className="btn btn-default" onClick={this.handleClose}>
                        {i18n._('key-Modal/Common-Cancel')}
                    </button>
                    <button type="button" className="btn btn-default" onClick={this.handleConfirm}>
                        {i18n._('key-Modal/Common-Yes')}
                    </button>
                </Modal.Footer>
            </Modal>
        );
    }
}

export default (options) => new Promise((resolve) => {
    const container = document.createElement('div');
    document.body.appendChild(container);

    const root = createRoot(container);
    const props = {
        ...options,
        onClose: () => {
            resolve();
        },
        container: container,
        root: root
    };

    root.render(<WarningModalHOC {...props} />);
});
