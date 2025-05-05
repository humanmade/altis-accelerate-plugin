import { useSelect } from '@wordpress/data';
import { __ } from '@wordpress/i18n';
import React from 'react';

import { Group, Operator } from '../../audiences/types';
import { Filter } from '../../utils/admin';

import {
	NUMERIC_OPERATIONS,
	STRING_OPERATIONS,
} from '../../audiences/data/constants';

import './Header.css';

type FilterItemProps = {
	operator: Operator,
	title: string,
	value: string,
	onRemove(): void,
}

const FilterItem = ( props: FilterItemProps ) => {
	return (
		<span className="">
			<span className="">
				<span className="font-bold">{ props.title }</span>
				{ ' ' }
				{ NUMERIC_OPERATIONS[ props.operator ] || STRING_OPERATIONS[ props.operator ] || props.operator }
				{ ' ' }
				{ props.value }
			</span>
		</span>
	);
};

type GroupSummaryProps = {
	definitions: FieldSetting[],
	group: Group,
};
function GroupSummary( props: GroupSummaryProps ) {
	const { definitions, group } = props;
	const label = ( id: string ) => definitions.find( d => d.name === id )?.label || id;
	console.log( group );
	return (
		<>
			{ group.groups?.filter( g => !! g.rules || !! g.groups ).map( ( group, i ) => (
				<React.Fragment key={ i }>
					<span className="text-gray-400 italic">
						{ i > 0 && ( group.include === 'any' ? ' or ' : ' and ' ) }
					</span>
					<GroupSummary
						definitions={ definitions }
						group={ group }
					/>
				</React.Fragment>
			) ) }
			{ group.rules?.filter( r => !! r.field ).map( ( rule, i ) => (
				<React.Fragment key={ i }>
					<span className="text-gray-400 italic">
						{ i > 0 && ( group.include === 'any' ? ' or ' : ' and ' ) }
					</span>
					<FilterItem
						key={ i }
						operator={ rule.operator as any }
						title={ label( rule.field ) }
						value={ rule.value }
						onRemove={ () => {} }
					/>
				</React.Fragment>
			) ) }
		</>
	);
}

interface FieldSetting {
	name: string,
	type: 'string' | 'number',
	label: string,
	options: any,
	data?: {
		label: string,
		value: string,
	}[],
}

export default function FilterSummary( props: { filter: Filter } ) {
	const { filter } = props;

	// @ts-ignore
	const definitions: FieldSetting[] = useSelect( select => select( 'audience' ).getFields(), [] );

	if ( ! filter.path && ! filter.audience ) {
		return <>{ __( 'All traffic', 'altis' ) }</>;
	}

	return (
		<>
			{ filter.path && (
				<FilterItem
					operator="="
					title={ __( 'Path', 'altis' ) }
					value={ filter.path }
					onRemove={ () => {} }
				/>
			) }
			{ filter.path && filter.audience && ' and ' }
			{ filter.audience && (
				<GroupSummary
					definitions={ definitions }
					group={ filter.audience }
				/>
			) }
		</>
	);
}
