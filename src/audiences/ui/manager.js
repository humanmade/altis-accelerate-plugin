import React, { Component } from 'react';
import styled from 'styled-components';

import { defaultPost } from '../data/defaults';

import AddNew from '../../components/AddNew';
import Edit from './edit';
import List from './list';

const { withSelect, withDispatch } = wp.data;
const { compose } = wp.compose;
const { __ } = wp.i18n;

const StyledManager = styled.div`
	.wp-header-end {
		margin-bottom: 14px;
	}
`;

/**
 * Audience manager component.
 */
class Manager extends Component {

	constructor( props ) {
		super( props );

		// Set default state.
		this.state = {
			view: 'list',
		};
	}

	render() {
		const {
			canCreate,
			onSelect,
			onSetCurrentPost,
		} = this.props;
		const { view } = this.state;

		const states = {
			list: {
				title: __( 'Audiences', 'altis' ),
				/**
				 * @returns {React.ReactNode} List interface.
				 */
				body: () => (
					<List
						controls={ () => {
							return canCreate ? (
								<AddNew
									className="add-new"
									isPrimary
									onClick={ () => {
										onSetCurrentPost( defaultPost );
										this.setState( { view: 'edit' } );
									} }
								>
									{ __( 'Add New', 'altis' ) }
								</AddNew>
							) : null;
						} }
						onEdit={ post => {
							onSetCurrentPost( post || defaultPost );
							this.setState( { view: 'edit' } );
						} }
						onSelect={ onSelect }
					/>
				),
			},
			edit: {
				title: __( 'Edit Audience', 'altis' ),
				/**
				 * @returns {React.ReactNode} Edit view.
				 */
				body: () => (
					<Edit
						onSelect={ onSelect }
						onViewList={ () => this.setState( { view: 'list' } ) }
					/>
				),
			},
		};

		const viewState = states[ view ];

		const Body = viewState.body;

		return (
			<StyledManager className="altis-ui altis-audience-manager">
				<Body />
			</StyledManager>
		);
	}
}

Manager.defaultProps = {
	canCreate: false,
	onSelect: null,
};

const applyWithSelect = withSelect( select => {
	const { canUser } = select( 'core' );
	const canCreate = canUser( 'create', 'audiences' );

	return {
		canCreate,
	};
} );

const applyWithDispatch = withDispatch( dispatch => {
	const { setCurrentPost } = dispatch( 'audience' );

	return {
		onSetCurrentPost: setCurrentPost,
	};
} );

export default compose(
	applyWithSelect,
	applyWithDispatch
)( Manager );
