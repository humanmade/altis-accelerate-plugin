import React, { Component, Fragment } from 'react';
import styled from 'styled-components';

import Modal from '../../components/modal';

import Manager from './manager';

const {
	IconButton,
	Spinner,
} = wp.components;
const { compose } = wp.compose;
const { withSelect } = wp.data;
const { decodeEntities } = wp.htmlEntities;
const { __ } = wp.i18n;

const StyledModal = styled( Modal )`
	.altis-audience-manager {
		&__header {
			position: fixed;
			left: 50px;
			top: 30px;
			z-index: 10;

			@media only screen and (max-width: 640px), screen and (max-height: 400px) {
				left: 20px;
				top: 0;
			}

			h1 {
				vertical-align: middle;
			}
		}
	}
	.altis-audience-manager table {
		width: 100%;
	}
`;

const StyledSelect = styled.div`
	.audience-select__label {
		display: block;
		margin-bottom: 4px;
	}
	.audience-select__controls {
		margin-left: -3px;
		display: flex;

		button {
			padding-left: 0;
			padding-right: 0;
			text-align: left;

			&:not(:disabled):not([aria-disabled=true]):not(.is-secondary):not(.is-primary):not(.is-tertiary):not(.is-link):hover,
			&:not(:disabled):not([aria-disabled=true]):not(.is-secondary):not(.is-primary):not(.is-tertiary):not(.is-link):focus {
				box-shadow: none;
			}

			strong {
				&:hover, &:focus {
					text-decoration: underline;
				}
			}
		}

		.dashicon {
			margin-right: 3px;
		}
	}
	.audience-select__clear {
		margin-left: -2px;
		margin-right: 5px;
		min-width: 0;

		&:hover, &:focus {
			color: #d94f4f;
		}

		&:hover svg, &:focus svg {
			fill: #d94f4f;
		}
	}
`;

/**
 * Select audience component.
 */
class Select extends Component {

	state = {
		show: false,
	}

	render() {
		const {
			audience,
			audiencePost,
			button = null,
			buttonLabel,
			icon = 'groups',
			label,
			onSelect,
			onClearSelection,
		} = this.props;
		const { show } = this.state;

		const buttonLabelDefault = audience
			? __( 'Change Audience', 'altis' )
			: __( 'Select Audience', 'altis' );

		const status = ( audiencePost && audiencePost.status ) || 'draft';
		const error = audiencePost && audiencePost.error && audiencePost.error.message;
		const title = audiencePost && audiencePost.title && audiencePost.title.rendered;

		const LabelText = this.props.hideLabel
			? <span className="screen-reader-text">{ buttonLabel || buttonLabelDefault }</span>
			: buttonLabel || buttonLabelDefault;

		const Modal = () => (
			<StyledModal
				portalId="altis-analytics-audience-modal"
				onClose={ () => this.setState( { show: false } ) }
			>
				<Manager
					onSelect={ post => {
						this.setState( { show: false } );
						onSelect( post.id, post );
					} }
				/>
			</StyledModal>
		);

		// Optional trigger override.
		if ( button ) {
			return (
				<>
					{ button( {
						onOpen: () => this.setState( { show: true } ),
						onClose: () => this.setState( { show: false } ),
					} ) }
					{ show && <Modal /> }
				</>
			);
		}

		return (
			<StyledSelect className="audience-select">
				<div className="audience-select__info">
					{ /* eslint-disable jsx-a11y/label-has-for */ }
					{ label && (
						<label className="audience-select__label">{ label }</label>
					) }
					<div className="audience-select__controls">
						{ audience && onClearSelection ? (
							<IconButton
								className="audience-select__clear"
								icon="no-alt"
								label={ __( 'Clear selection', 'altis' ) }
								onClick={ onClearSelection }
							/>
						) : null }
						<IconButton
							className="audience-select__choose"
							icon={ icon }
							label={ buttonLabel || buttonLabelDefault }
							onClick={ e => {
								e.preventDefault();
								e.stopPropagation();
								this.setState( { show: true } );
							} }
						>
							{ audience && ! audiencePost ? (
								<Fragment>
									<Spinner />
									{ __( 'Loading...', 'altis' ) }
								</Fragment>
							) : null }
							{ error && (
								<strong className="audience-select__value audience-select__value--error">{ error }</strong>
							) }
							{ status === 'trash' && title && (
								<strong className="audience-select__value">{ __( '(deleted)', 'altis' ) }</strong>
							) }
							{ status !== 'trash' && title && (
								<strong className="audience-select__value">{ decodeEntities( title ) }</strong>
							) }
							{ ! audience && ( LabelText ) }
						</IconButton>
					</div>
				</div>
				{ show && ( <Modal /> ) }
			</StyledSelect>
		);
	}
}

const applyWithSelect = withSelect( ( select, props ) => {
	let audiencePost = null;

	// Check if the current user can create audiences. If so, they should have create permissions sent to getPost.
	const canCreate = select( 'core' ).canUser( 'create', 'audiences' );
	const queryArgs = canCreate ? { context: 'edit' } : {};

	if ( props.audience ) {
		audiencePost = select( 'audience' ).getPost( props.audience, queryArgs );
	}

	return {
		audiencePost,
	};
} );

export default compose(
	applyWithSelect
)( Select );
