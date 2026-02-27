import { ChevronDown } from 'lucide-react';
import React from 'react';

import { decodeEntities } from '@wordpress/html-entities';
import { __, sprintf } from '@wordpress/i18n';

import { CustomFilters, Duration, PostType, trackEvent, PeriodObject } from '../../utils/admin';

import { SearchField } from '@/components/SearchField';
import { AnimatedTabs } from '@/components/ui/animated-tabs';
import { Button } from '@/components/ui/button';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

type Props = {
	listId: string,
	searchPlaceholder: string,
	customFilters: CustomFilters,
	periods: PeriodObject[],
	postTypes: PostType[],
	period?: Duration,
	onSetPeriod: React.Dispatch<React.SetStateAction<Duration>>,
	customFilter: string,
	onSetCustomFilter: Function,
	onSetSearch: React.Dispatch<React.SetStateAction<string>>,
	onAddNewItem: Function,
};

export default function ListFilters( props: Props ) {
	const {
		listId,
		periods,
		customFilters,
		postTypes,
		searchPlaceholder,
		period,
		onSetPeriod,
		customFilter,
		onSetCustomFilter,
		onSetSearch,
		onAddNewItem,
	} = props;

	function onAddNew( type: string ) {
		trackEvent( listId, 'Add New', { type } );
		return onAddNewItem( type );
	}

	return (
		<form
			className="table-controls"
			method="POST"
			onSubmit={ e => {
				e.preventDefault();
			} }
		>
			<div className="table-filter table-filter__period">
				<AnimatedTabs
					options={ periods.map( p => ( {
						value: p.value,
						label: String( p.label.match( /\d+/ )?.[0] || p.label ),
					} ) ) }
					value={ period || periods[0].value }
					onValueChange={ ( value: Duration ) => {
						trackEvent( listId, 'Period', { type: value } );
						onSetPeriod( value );
					} }
				/>
			</div>
			<div className="table-filter table-filter__custom">
				<AnimatedTabs
					options={ Object.entries( customFilters ).map( ( [ value, { label } ] ) => ( {
						value,
						label,
					} ) ) }
					value={ customFilter }
					onValueChange={ ( value: string ) => {
						trackEvent( listId, 'Filter', { type: value } );
						onSetCustomFilter( value );
					} }
				/>
			</div>
			<div className="table-search">
				<SearchField
					placeholder={ searchPlaceholder }
					onChange={ value => {
						trackEvent( listId, 'Search' );
						onSetSearch( value );
					} }
				/>
			</div>
			<div className="table-add-new">
				{ postTypes.length === 1 ? (
					<Button onClick={ () => onAddNew( postTypes[0].name ) }>
						{ sprintf( __( 'Add %s', 'altis' ), decodeEntities( postTypes[0].singular_label ) ) }
					</Button>
				) : (
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button>
								{ __( 'Add New', 'altis' ) }
								<ChevronDown className="ml-2 h-4 w-4" />
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end">
							{ postTypes.map( type => (
								<DropdownMenuItem
									key={ type.name }
									onClick={ () => onAddNew( type.name ) }
								>
									{ decodeEntities( type.singular_label ) }
								</DropdownMenuItem>
							) ) }
						</DropdownMenuContent>
					</DropdownMenu>
				) }
			</div>
		</form>
	);
}
