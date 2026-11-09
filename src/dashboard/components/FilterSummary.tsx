import React from 'react';

import { useSelect } from '@wordpress/data';
import { __ } from '@wordpress/i18n';

import {
	NUMERIC_OPERATIONS,
	STRING_OPERATIONS,
} from '../../audiences/data/constants';
import { defaultAudience } from '../../audiences/data/defaults';
import { Group, Operator } from '../../audiences/types';
import { Filter } from '../../utils/admin';

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

// Friendly labels for the whitelisted dimension keys (see
// get_dimension_field_map() in inc/api/namespace.php). Built lazily so __()
// runs with the locale loaded.
function dimensionLabel( field: string ): string {
	const labels: Record<string, string> = {
		referer: __( 'Referrer', 'altis' ),
		country: __( 'Country', 'altis' ),
		utm_campaign: __( 'UTM campaign', 'altis' ),
		utm_source: __( 'UTM source', 'altis' ),
		utm_medium: __( 'UTM medium', 'altis' ),
		search: __( 'Search', 'altis' ),
		browser: __( 'Browser', 'altis' ),
		os: __( 'OS', 'altis' ),
	};
	return labels[ field ] || field;
}

export default function FilterSummary( props: { filter: Filter } ) {
	const { filter } = props;

	// @ts-ignore
	const definitions: FieldSetting[] = useSelect( select => select( 'audience' )?.getFields() || [], [] );

	const dimensionEntries = Object.entries( filter.dimensions || {} );

	if (
		( ! filter.path && ! filter.audience && dimensionEntries.length === 0 ) ||
		( filter?.audience === defaultAudience && ! filter.path && dimensionEntries.length === 0 )
	) {
		return <>{ __( 'All traffic', 'altis' ) }</>;
	}

	// Dimension chips render as "Label is value", composing with " and " — and
	// alongside any path/audience parts.
	const dimensionParts = dimensionEntries.map( ( [ field, value ] ) => (
		<FilterItem
			key={ `dim-${ field }` }
			operator="="
			title={ dimensionLabel( field ) }
			value={ value === '' ? __( 'Direct', 'altis' ) : value }
			onRemove={ () => {} }
		/>
	) );

	// Collect every active filter part, then join with " and " so path,
	// audience and any dimension chips read as one sentence.
	const parts: React.ReactNode[] = [];

	if ( filter.path ) {
		parts.push(
			<FilterItem
				key="path"
				operator="="
				title={ __( 'Path', 'altis' ) }
				value={ filter.path }
				onRemove={ () => {} }
			/>
		);
	}

	// If a named audience is selected, show its name; otherwise summarise the
	// audience rule group.
	if ( filter.audienceName ) {
		parts.push( <span key="audience-name" className="font-bold">{ filter.audienceName }</span> );
	} else if ( filter.audience ) {
		parts.push(
			<GroupSummary
				key="audience"
				definitions={ definitions }
				group={ filter.audience }
			/>
		);
	}

	parts.push( ...dimensionParts );

	return (
		<>
			{ parts.map( ( part, i ) => (
				<React.Fragment key={ i }>
					{ i > 0 && ' and ' }
					{ part }
				</React.Fragment>
			) ) }
		</>
	);
}
