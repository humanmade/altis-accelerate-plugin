import React, { Component, Fragment } from 'react';
import styled from 'styled-components';

import { Button, Notice, Spinner } from '@wordpress/components';
import { compose } from '@wordpress/compose';
import { withSelect, withDispatch } from '@wordpress/data';
import { decodeEntities } from '@wordpress/html-entities';
import { __ } from '@wordpress/i18n';

import { store } from '../data';
import { defaultPost, defaultAudience } from '../data/defaults';
import { Audience, Post } from '../types';

import AudienceEditor from './components/audience-editor';
import { DynamicEstimate } from './components/estimate';
import StatusToggle from './components/status-toggle';

const StyledEdit = styled.div`
	margin: 20px 5%;

	.back {
		margin-bottom: 20px;
	}

	.components-notice {
		margin: 0 0 20px;
	}

	.audience-settings {
		display: flex;
	}

	.audience-settings > * {
		flex: 1;
	}

	.audience-options {
		flex: 0 1 320px;
		margin: 20px 0 20px 40px;
	}

	.audience-estimate {
		margin-bottom: 40px;
	}
`;

interface ExternalProps {
	post?: Post;
	postId?: number;
	/**
	 * Select handler. If present, a select button will be shown.
	 *
	 * @param {Object} post Post object.
	 */
	onSelect?: ( post: Post ) => void;
	/**
	 * View list handler.
	 */
	onViewList: () => void;
}

interface Props {
	post: Post;
	/**
	 * Whether the user can create new audiences.
	 */
	canCreate: boolean;
	/**
	 * Whether the user can edit the current audience.
	 */
	canEdit: boolean;
	/**
	 * Whether the audience is loading.
	 */
	loading?: boolean;
	/**
	 * Whether the audience is being saved.
	 */
	saving?: boolean;
	/**
	 * Create post handler.
	 *
	 * @param {Object} post Post object data.
	 */
	onCreatePost: ( post: Post ) => void;
	/**
	 * Set audience handler.
	 *
	 * @param {Object} value Audience config object.
	 */
	onSetAudience: ( value: object ) => void;
	/**
	 * Set status handler.
	 *
	 * @param {string} value New post status.
	 */
	onSetStatus: ( value: string ) => void;
	/**
	 * Set title handler.
	 *
	 * @param {string} value New post title.
	 */
	onSetTitle: ( value: string ) => void;
	/**
	 * Update post handler.
	 *
	 * @param {Object} post Post object with updates.
	 */
	onUpdatePost: ( post: Post ) => void;
}

/**
 * Edit audience component.
 */
class Edit extends Component<Props & ExternalProps> {
	static defaultProps: Partial<Props & ExternalProps> = {
		loading: false,
		post: defaultPost as Post,
		postId: undefined,
		saving: false,
		onCreatePost: () => {},
		onSelect: undefined,
		onSetAudience: () => {},
		onSetStatus: () => {},
		onSetTitle: () => {},
		onUpdatePost: () => {},
	};

	state: { error: string | null; hasEdits: boolean; notice: string | null } = {
		error: null,
		hasEdits: false,
		notice: null,
	};

	onBeforeUnload: ( ( arg: unknown ) => unknown ) | null | typeof window.onbeforeunload = null;

	static getDerivedStateFromError( error: Error ) {
		return { error };
	}

	componentDidMount() {
		this.onBeforeUnload = window.onbeforeunload;
		/**
		 * Overwrite window unload function.
		 *
		 * @returns {bool} True if there are no unsaved edits.
		 */
		window.onbeforeunload = () => {
			if ( this.state.hasEdits ) {
				return true;
			}
		};
	}

	componentWillUnmount() {
		window.onbeforeunload = this.onBeforeUnload;
	}

	componentDidCatch( error: Error, errorInfo: React.ErrorInfo ) {
		console.error( error, errorInfo );
	}

	/**
	 * Handle audience save / update.
	 */
	onSubmit = ( event: React.MouseEvent<HTMLButtonElement> ) => {
		// Clear errors.
		this.setState( { error: null } );

		const { post, onCreatePost, onUpdatePost } = this.props;

		if ( post && post.title.rendered.length === 0 ) {
			event.preventDefault();
			this.setState( {
				error: __( 'The title cannot be empty', 'altis' ),
			} );
			return;
		}

		// Update if we have an ID, otherwise create a new one.
		if ( post.id ) {
			onUpdatePost( post );
		} else {
			onCreatePost( post );
		}

		// Edits have been saved now so it's safe to navigate again.
		this.setState( { hasEdits: false } );
	};

	render() {
		const {
			canCreate,
			canEdit,
			loading,
			post,
			saving,
			onSelect,
			onSetAudience,
			onSetTitle,
			onSetStatus,
			onViewList,
		} = this.props;

		const { error, notice } = this.state;

		// Check for REST API errors.
		if ( post && post.error && post.error.message ) {
			return <Notice status="error">{ post.error.message }</Notice>;
		}

		// Check status is valid.
		if ( post && post.status === 'trash' ) {
			return <Notice status="error">{ __( 'This audience has been deleted.', 'altis' ) }</Notice>;
		}

		// Check permission for editing.
		if ( post && post.id && canEdit === false ) {
			return <Notice status="error">{ __( 'You do not have permission to edit this audience.', 'altis' ) }</Notice>;
		}

		// Check permission for creating.
		if ( post && ! post.id && canCreate === false ) {
			return <Notice status="error">{ __( 'You do not have permission to create new audiences.', 'altis' ) }</Notice>;
		}

		const isPublished = post && post.status === 'publish';

		return (
			<StyledEdit className={ `audience-ui ${ loading ? 'audience-ui--loading' : '' }` }>
				<Button className="back" isLink onClick={ () => onViewList() }>
					← { __( 'Back to audience list', 'altis' ) }
				</Button>
				{ error && (
					<Notice isDismissible status="error" onRemove={ () => this.setState( { error: null } ) }>
						{ error.toString() }
					</Notice>
				) }
				{ notice && (
					<Notice isDismissible status="success" onRemove={ () => this.setState( { notice: null } ) }>
						{ notice }
					</Notice>
				) }

				<div id="titlediv">
					<input
						autoFocus
						disabled={ loading }
						id="title"
						name="post_title"
						placeholder={ __( 'Add title', 'altis' ) }
						type="text"
						value={ decodeEntities( post.title.rendered ) }
						onChange={ event => {
							this.setState( { hasEdits: true } );
							onSetTitle( event.target.value );
						} }
					/>
				</div>

				<div className="audience-settings">
					<AudienceEditor
						audience={ post.audience || defaultAudience }
						onChange={ audience => {
							this.setState( { hasEdits: true } );
							onSetAudience( audience );
						} }
					/>

					<div className="audience-options">
						<DynamicEstimate audience={ post.audience } sparkline title={ __( 'Audience size', 'altis' ) } />
						<h3>{ __( 'Audience options', 'altis' ) }</h3>
						<StatusToggle
							disabled={ loading }
							status={ post.status }
							onChange={ () => {
								this.setState( { hasEdits: true } );
								onSetStatus( isPublished ? 'draft' : 'publish' );
							} }
						/>
						<Button disabled={ loading || saving } isPrimary type="submit" onClick={ this.onSubmit }>
							{ isPublished && ! post.id && __( 'Publish' ) }
							{ ! isPublished && ! post.id && __( 'Save Draft' ) }
							{ post.id && __( 'Update' ) }
							{ saving && <Spinner /> }
						</Button>
						{ post.id && onSelect && (
							<Fragment>
								{ ' ' }
								<Button disabled={ ! isPublished } onClick={ () => onSelect( post ) }>
									{ __( 'Select', 'altis' ) }
								</Button>
							</Fragment>
						) }
					</div>
				</div>
			</StyledEdit>
		);
	}
}
// @ts-ignore No good way to type this yet.
const applyWithSelect = withSelect( ( select, props ) => {
	const { getCurrentPost, getIsLoading, getIsUpdating } = select( store );

	let post = getCurrentPost() || props.post;

	if ( props.postId ) {
		post = getCurrentPost( props.postId );
	}

	// If we have a post ID but no post then we're loading.
	const loading = getIsLoading();

	// Determine if we're currently saving the post.
	const saving = getIsUpdating();

	// Permissions check.
	const { canUser } = select( 'core' );
	const canCreate = canUser( 'create', 'audiences' );
	const canEdit = canUser( 'update', 'audiences', post.id || props.postId );

	return {
		canCreate,
		canEdit,
		loading,
		post,
		saving,
	};
} );

// @ts-ignore No good way to type this yet.
const applyWithDispatch = withDispatch( dispatch => {
	const { createPost, updateCurrentPost, updatePost } = dispatch( store );

	return {
		onCreatePost: ( post: Post ) => createPost( post ),
		onSetAudience: ( value?: Audience ) => updateCurrentPost( { audience: value } ),
		onSetTitle: ( value: string ) =>
			updateCurrentPost( {
				title: {
					rendered: value,
					raw: value,
				},
			} ),
		onSetStatus: ( value: string ) => updateCurrentPost( { status: value } ),
		onUpdatePost: ( post: Post ) => updatePost( post ),
	};
} );

export default compose( applyWithDispatch, applyWithSelect )( Edit ) as React.ComponentType<ExternalProps>;
