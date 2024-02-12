import React, { useState } from 'react';
import styled from 'styled-components';

import Modal from '../../components/modal';

import Insights from './insights';

import './popup.scss';

const { Button } = wp.components;
const { useSelect } = wp.data;
const { __ } = wp.i18n;

const StyledModal = styled( Modal )`
	margin: 0 auto;
	max-width: 70rem;

	&& .media-frame-content {
		top: 0;
		border: 0;
	}

	.altis-analytics-block {
		margin-left: 0;
	}

	.altis-analytics-block__title {
		margin-top: 20px;
	}
`;

const StyledPopup = styled.div`
	margin: 10px 0 20px;
`;

/**
 * Select audience component.
 *
 * @param {Object} props Component props.
 * @param {string} props.clientId The block client ID.
 * @returns {React.ReactNode} The popup controller component.
 */
function Popup( { clientId } ) {

	const [ show, setShow ] = useState( false );
	const block = useSelect( select => {
		return select( 'accelerate/xbs' ).getPost( clientId );
	}, [ clientId ] );

	if ( ! block || block.error ) {
		return null;
	}

	return (
		<StyledPopup className="altis-popup">
			<div className="altis-popup__button">
				<Button
					isPrimary
					onClick={ () => setShow( true ) }
				>
					{ __( 'View experience insights', 'altis' ) }
				</Button>
			</div>
			{ show && (
				<StyledModal
					portalId="altis-analytics-xb-block-modal"
					onClose={ () => setShow( false ) }
				>
					<Insights clientId={ clientId } showPosts={ false } />
				</StyledModal>
			) }
		</StyledPopup>
	);
}

export default Popup;
