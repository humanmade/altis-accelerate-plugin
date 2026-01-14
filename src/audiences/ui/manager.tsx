import React, { Component } from 'react';
import styled from 'styled-components';

import { compose } from '@wordpress/compose';
import { withSelect, withDispatch } from '@wordpress/data';
import { __ } from '@wordpress/i18n';

import AddNew from '../../components/AddNew';
import { store } from '../data';
import { defaultPost } from '../data/defaults';
import { Post } from '../types';

import Edit from './edit';
import List from './list';

const StyledManager = styled.div`
	.wp-header-end { margin-bottom: 14px; }
`;

interface ManagerProps {
	canCreate: boolean;
	onSetCurrentPost: ( post: Post | Partial<Post> ) => void;
	onSelect?: ( post: Post ) => void;
}

interface ManagerState { view: 'list' | 'edit'; }

class Manager extends Component<ManagerProps, ManagerState> {
	static defaultProps: Partial<ManagerProps> = { canCreate: false };

	state: ManagerState = { view: 'list' };

	render() {
		const { canCreate, onSelect, onSetCurrentPost } = this.props;
		const { view } = this.state;

		const states: Record<ManagerState['view'], { title: string; body: () => React.ReactNode }> = {
			list: {
				title: __( 'Audiences', 'altis' ),
				body: () => (
					<List
						controls={ () => canCreate ? (
							<AddNew
								label={ __( 'Add New', 'altis' ) }
								onClick={ () => {
									onSetCurrentPost( defaultPost as Post );
									this.setState( { view: 'edit' } );
								} }
							/>
						) : null }
						onEdit={ ( post?: Post ) => {
							onSetCurrentPost( ( post || defaultPost ) as Post );
							this.setState( { view: 'edit' } );
						} }
						onSelect={ onSelect }
					/>
				),
			},
			edit: {
				title: __( 'Edit Audience', 'altis' ),
				body: () => (
					<Edit
						onSelect={ onSelect }
						onViewList={ () => this.setState( { view: 'list' } ) }
					/>
				),
			},
		};

		const Body = states[ view ].body;
		return (
			<StyledManager className="altis-ui altis-audience-manager">
				<Body />
			</StyledManager>
		);
	}
}

const applyWithSelect = withSelect( ( select: any ) => {
	const { canUser } = select( 'core' );
	return { canCreate: canUser( 'create', 'audiences' ) };
} );

const applyWithDispatch = withDispatch( ( dispatch: any ) => {
	const { setCurrentPost } = dispatch( store );
	return { onSetCurrentPost: setCurrentPost };
} );

export default compose( applyWithSelect, applyWithDispatch )( Manager ) as React.ComponentType<ManagerProps>;
