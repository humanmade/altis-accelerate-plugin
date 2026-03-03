import React, { Component } from 'react';

import { compose } from '@wordpress/compose';
import { withSelect, withDispatch } from '@wordpress/data';
import { __ } from '@wordpress/i18n';

import { store } from '../data';
import { defaultPost } from '../data/defaults';
import { Post } from '../types';

import Edit from './edit';
import List from './list';

import { Button } from '@/components/ui/button';

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
							<Button
								onClick={ () => {
									onSetCurrentPost( defaultPost as Post );
									this.setState( { view: 'edit' } );
								} }
							>
								{ __( 'Add New', 'altis' ) }
							</Button>
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
			<div className="altis-ui altis-audience-manager">
				<Body />
			</div>
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
