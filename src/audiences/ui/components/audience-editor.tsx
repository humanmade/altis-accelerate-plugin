import React, { Component } from 'react';

import { __ } from '@wordpress/i18n';

import {
	defaultAudience,
	defaultGroup,
} from '../../data/defaults';
import { Audience } from '../../types';

import Group from './group';
import SelectInclude from './select-include';

import { Button } from '@/components/ui/button';

interface Props {
	/**
	 * Audience object.
	 */
	audience: Audience;
	/**
	 * Change handler.
	 */
	onChange: ( audience: Audience ) => void;
	/**
	 * Whether the editor is in read-only mode.
	 */
	readOnly?: boolean;
}

/**
 * Audience Editor Component.
 */
export default class AudienceEditor extends Component<Props> {
	/**
	 * Change rule inclusion setting.
	 *
	 * @param {Event} e Change event object.
	 */
	onChangeInclude = ( e: React.ChangeEvent<HTMLSelectElement> ) => {
		this.props.onChange( {
			...this.props.audience,
			include: e.target.value as 'all' | 'any',
		} );
	};

	/**
	 * Add rule group handler.
	 */
	onAddGroup = () => {
		this.props.onChange( {
			...this.props.audience,
			groups: [
				...( this.props.audience.groups || [] ),
				defaultGroup,
			],
		} );
	};

	/**
	 * Update group handler.
	 *
	 * @param {number} id Group index.
	 * @param {Object} group Group config object.
	 */
	onUpdateGroup = ( id: number, group: Partial<Group> ) => {
		const { audience } = this.props;
		this.props.onChange( {
			...audience,
			groups: [
				...audience.groups.slice( 0, id ),
				{
					...audience.groups[ id ],
					...group,
				},
				...audience.groups.slice( id + 1 ),
			],
		} );
	};

	/**
	 * Remove group handler.
	 *
	 * @param {number} id Group index.
	 */
	onRemoveGroup = ( id: number ) => {
		const { audience } = this.props;
		this.props.onChange( {
			...audience,
			groups: [
				...audience.groups.slice( 0, id ),
				...audience.groups.slice( id + 1 ),
			],
		} );
	};

	render() {
		const { audience, readOnly } = this.props;

		return (
			<div className="tailwind mb-10">
				<div className="my-5">
					<SelectInclude
						label={ __( 'groups', 'altis' ) }
						name="audience[include]"
						readOnly={ readOnly }
						value={ audience.include }
						onChange={ this.onChangeInclude }
					/>
				</div>

				{ audience.groups?.map( ( group, groupId ) => (
					<Group
						key={ groupId }
						canRemove={ ! readOnly }
						namePrefix={ `audience[groups][${ groupId }]` }
						readOnly={ readOnly }
						title={ `${ __( 'Group' ) } ${ groupId + 1 }` }
						onChange={ value => this.onUpdateGroup( groupId, value ) }
						onRemove={ () => this.onRemoveGroup( groupId ) }
						{ ...group }
					/>
				) ) }

				{ ! readOnly && (
					<Button
						variant="outline"
						onClick={ this.onAddGroup }
					>
						{ __( 'Add a group', 'altis' ) }
					</Button>
				) }
			</div>
		);
	}
}

AudienceEditor.defaultProps = {
	audience: defaultAudience,
	/**
	 * Default group update handler.
	 */
	onChange: () => {},
};
