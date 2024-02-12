import React from 'react';
import { __ } from '@wordpress/i18n';
import { Dropdown, Button, MenuGroup, MenuItem, __experimentalRadioGroup as RadioGroup, __experimentalRadio as Radio } from '@wordpress/components';
import { decodeEntities } from '@wordpress/html-entities';
import Search from '../../components/Search';

import { CustomFilters, Duration, PostType, trackEvent, PeriodObject } from '../../utils/admin';

let timer: ReturnType<typeof setTimeout> | undefined;

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

export default function ListFilters ( props: Props ) {
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
			<div className="table-filter table-filter__period radio-group">
				<RadioGroup
					checked={ period }
					label='Period'
					onChange={ ( value: Duration ) => {
						trackEvent( listId, 'Period', { type: value } );
						onSetPeriod( value );
					} }
				>
					{ periods.map( p => (
						<Radio
							key={ p.value }
							checked={ p.value === period }
							value={ p.value }
						>
							{ p.label.match( /\d+/ ) }
						</Radio>
					) ) }
				</RadioGroup>
			</div>
			<div className="table-filter table-filter__custom" >
				<RadioGroup
					checked={ customFilter }
					label='Filter'
					onChange={ ( value: string ) => {
						trackEvent( listId, 'Filter', { type: value } );
						onSetCustomFilter( value )
					} }
				>
					{ Object.entries( customFilters ).map( ( [ value, { label } ] )  => (
						<Radio
							key={ value }
							checked={ value === customFilter }
							value={ value }
						>
							{ label }
						</Radio>
					) ) }
				</RadioGroup>
			</div>
			<div className="table-search">
				<Search
					placeholder={ searchPlaceholder }
					onChange={ e => {
						timer && clearTimeout( timer );
						timer = setTimeout( value => {
							trackEvent( listId, 'Search' );
							onSetSearch( value );
						}, 500, e.target.value );
					} }
				/>
			</div>
			<div className="table-add-new">
				{ postTypes.length === 1 ? (
					<Button
						className='dashicons-before dashicons-plus'
						isPrimary
						onClick={ () => onAddNew( postTypes[0].name ) }
					>
						{ __( 'Add New', 'altis' ) }
					</Button>
				) : (
					<Dropdown
						className=""
						contentClassName=""
						position="bottom center"
						renderContent={ () => (
							<MenuGroup>
								{ postTypes.map( type => (
									<MenuItem key={ type.name } onClick={ () => onAddNew( type.name ) }>
										{ decodeEntities( type.singular_label ) }
									</MenuItem>
								) ) }
							</MenuGroup>
						) }
						renderToggle={ ( { isOpen, onToggle } ) => (
							<Button
								aria-expanded={ isOpen }
								className='dashicons-before dashicons-plus'
								isPrimary
								onClick={ onToggle }
							>
								{ __( 'Add New', 'altis' ) }
							</Button>
						) }
					/>
				) }
			</div>
		</form>
	);
}
