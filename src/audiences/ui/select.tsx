import React, { Component, Fragment } from 'react';
import styled from 'styled-components';

import { Button, Spinner } from '@wordpress/components';
import { compose } from '@wordpress/compose';
import { withSelect } from '@wordpress/data';
import { decodeEntities } from '@wordpress/html-entities';
import { __ } from '@wordpress/i18n';

import Modal from '../../components/modal';
import { store } from '../../data';
import { Post } from '../types';

import Manager from './manager';

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
			h1 { vertical-align: middle; }
		}
	}
	.altis-audience-manager table { width: 100%; }
`;

const StyledSelect = styled.div`
	.audience-select__label { display: block; margin-bottom: 4px; }
	.audience-select__controls {
		margin-left: -3px;
		display: flex;
		button { padding-left: 0; padding-right: 0; text-align: left; }
		button:not(:disabled):hover strong, button:not(:disabled):focus strong { text-decoration: underline; }
		.dashicon { margin-right: 3px; }
	}
	.audience-select__clear { margin-left: -2px; margin-right: 5px; min-width: 0; }
`;

interface SelectProps {
	audience?: number;
	button?: ( controls: { onOpen: () => void; onClose: () => void } ) => React.ReactNode;
	buttonLabel?: string;
	icon?: string;
	label?: string;
	hideLabel?: boolean;
	onSelect: ( id: number, post: Post ) => void;
	onClearSelection?: () => void;
	audiencePost?: ( Post & { error?: { message?: string } } ) | null;
}

interface SelectState { show: boolean; }

const ManagerComponent = Manager as unknown as React.ComponentType<{ onSelect?: ( post: Post ) => void }>;

class Select extends Component<SelectProps, SelectState> {
	state: SelectState = { show: false };

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
			hideLabel,
		} = this.props;
		const { show } = this.state;

		const buttonLabelDefault = audience ? __( 'Change Audience', 'altis' ) : __( 'Select Audience', 'altis' );
		const status = audiencePost?.status || 'draft';
		const error = audiencePost?.error?.message;
		const title = audiencePost?.title?.rendered;

		const LabelText = hideLabel ? (
			<span className="screen-reader-text">{ buttonLabel || buttonLabelDefault }</span>
		) : ( buttonLabel || buttonLabelDefault );

		const ManagerModal = () => (
			<StyledModal
				portalId="altis-analytics-audience-modal"
				onClose={ () => this.setState( { show: false } ) }
			>
				<ManagerComponent
					onSelect={ ( post: Post ) => {
						this.setState( { show: false } );
						onSelect( post.id, post );
					} }
				/>
			</StyledModal>
		);

		if ( button ) {
			return (
				<>
					{ button( {
						onOpen: () => this.setState( { show: true } ),
						onClose: () => this.setState( { show: false } ),
					} ) }
					{ show && <ManagerModal /> }
				</>
			);
		}

		return (
			<StyledSelect className="audience-select">
				<div className="audience-select__info">
					{ label && <label className="audience-select__label">{ label }</label> }
					<div className="audience-select__controls">
						{ audience && onClearSelection ? (
							<Button
								className="audience-select__clear"
								icon="no-alt"
								onClick={ onClearSelection }
							>
								{ __( 'Clear selection', 'altis' ) }
							</Button>
						) : null }
						<Button
							className="audience-select__choose"
							icon={ icon as any }
							onClick={ ( e: React.MouseEvent<HTMLButtonElement> ) => {
								e.preventDefault();
								e.stopPropagation();
								this.setState( { show: true } );
							} }
						>
							{ audience && ! audiencePost && (
								<Fragment>
									<Spinner />
									{ __( 'Loading...', 'altis' ) }
								</Fragment>
							) }
							{ error && (
								<strong className="audience-select__value audience-select__value--error">{ error }</strong>
							) }
							{ status === 'trash' && title && (
								<strong className="audience-select__value">{ __( '(deleted)', 'altis' ) }</strong>
							) }
							{ status !== 'trash' && title && (
								<strong className="audience-select__value">{ decodeEntities( title ) }</strong>
							) }
							{ ! audience && LabelText }
						</Button>
					</div>
				</div>
				{ show && <ManagerModal /> }
			</StyledSelect>
		);
	}
}

const applyWithSelect = withSelect( ( select: ( key: string ) => unknown, props: SelectProps ) => {
	let audiencePost: SelectProps['audiencePost'] = null;
	const core = select( 'core' );
	const canCreate = core.canUser( 'create', 'audiences' );
	const queryArgs = canCreate ? { context: 'edit' } : {};
	if ( props.audience ) {
		audiencePost = select( store ).getPost( props.audience, queryArgs );
	}
	return { audiencePost };
} );

export default compose( applyWithSelect )( Select );
