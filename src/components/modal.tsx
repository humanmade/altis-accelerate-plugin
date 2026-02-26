import React, { Component, Fragment } from 'react';
import { createPortal } from 'react-dom';
import styled from 'styled-components';

import { __ } from '@wordpress/i18n';

const StyledModal = styled.div`
	z-index: 1000002 !important;
	.media-frame-content {
		bottom: 0;
	}
`;

interface Props {
	children: React.ReactNode;
	className?: string;
	onClose: () => void;
	portalId: string;
	title?: string;
}

/**
 * Audience Editor Modal.
 */
class Modal extends Component<Props> {
	private modalRoot: HTMLElement | null;
	private el: HTMLDivElement;
	constructor( props: Props ) {
		super( props );
		this.modalRoot = document.getElementById( props.portalId );
		this.el = document.createElement( 'div' );
	}

	componentDidMount() {
		this.modalRoot?.appendChild( this.el );
	}

	componentWillUnmount() {
		this.modalRoot?.removeChild( this.el );
	}

	render() {
		const {
			children,
			className,
			onClose,
			title,
		} = this.props;

		return createPortal(
			<Fragment>
				<StyledModal
					aria-labelledby="media-frame-title"
					className={ `media-modal wp-core-ui ${ className }` }
					role="dialog"
					tabIndex={ 0 }
					onClick={ event => {
						// Prevent the modal closing due to clicks propagating
						// through to sub layers.
						event.stopPropagation();
					} }
				>
					<button className="media-modal-close" type="button" onClick={ onClose }>
						<span className="media-modal-icon">
							<span className="screen-reader-text">{ __( 'Close dialog' ) }</span>
						</span>
					</button>
					{ title && (
						<div className="media-frame-title" id="media-frame-title">
							<h1>{ title }</h1>
						</div>
					) }
					<div className="media-modal-content" role="document">
						<div className="media-frame wp-core-ui hide-menu hide-router">
							<div className="media-frame-content">
								{ children }
							</div>
						</div>
					</div>
				</StyledModal>
				<div className="media-modal-backdrop" style={ { zIndex: 1000001 } }></div>
			</Fragment>,
			this.el
		);
	}
}

export default Modal;
