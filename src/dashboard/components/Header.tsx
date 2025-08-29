import { Button, DropdownMenu, MenuGroup, MenuItem } from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import moment from 'moment';
import React, { useState } from 'react';
import { DateRangePicker, FocusedInputShape } from 'react-dates';

import { cx } from '../../lib/utils';
import { Duration, Filter, SelectableDate } from '../../utils/admin';
import FilterSummary from './FilterSummary';
import FilterEditor from './FilterEditor';

const TIME_FILTERS = {
	'P7D': __( 'Last 7 days', 'altis' ),
	'P14D': __( 'Last 14 days', 'altis' ),
	'P30D': __( 'Last 30 days', 'altis' ),
	'P1M': __( 'Last month', 'altis' ),
	'P60D': __( 'Last 60 days', 'altis' ),
	'P90D': __( 'Last 90 days', 'altis' ),
};

interface Props {
	filter: Filter,
	period: SelectableDate,
	onChangePeriod( period: SelectableDate ): void,
	onRefresh(): void,
	onUpdateFilter( filter: Filter ): void,
}

export default function Header( props: Props ) {
	const { filter, period, onUpdateFilter } = props;

	const [ nextFilter, setNextFilter ] = useState<Filter>( filter );
	const [ showingEditor, setShowingEditor ] = useState( false );
	const [ focused, setFocused ] = useState<FocusedInputShape | null>( null );

	const now = new Date();

	const onSelectItem = ( period: SelectableDate, onClose: () => void ) => () => {
		onClose();
		props.onChangePeriod( period );
	};
	const onSelectCustom = ( onClose: () => void ) => () => {
		onClose();
		props.onChangePeriod( {
			start: moment( now ).startOf( 'week' ),
			end: moment( now ).endOf( 'day' )
		} );
	};
	const onOpenFilters = () => {
		setNextFilter( filter );
		setShowingEditor( true );
	};

	const hasFilters = !! filter.path || !! filter.audience;
	const dropdownText = typeof period !== 'string' ? undefined : TIME_FILTERS[ period ];

	return (
		<header
			className="-mt-4 mb-6 mx-2 lg:mx-16 md:mx-4 flex items-center justify-between"
		>
			<div className="grow flex items-center gap-2">
				<button
					className={ cx( [
						'flex w-full select-none items-center justify-between gap-2 truncate rounded-md border px-3 py-2 shadow-sm outline-none transition sm:text-sm',
						'cursor-pointer',
						'border-gray-300',
						hasFilters ? 'text-gray-900' : 'text-gray-500',
						'bg-white',
						'hover:bg-gray-50',
					] ) }
					type="button"
					onClick={ onOpenFilters }
				>
					<span className="grow w-[400px] text-left overflow-hidden text-ellipsis">
						<FilterSummary
							filter={ filter }
						/>
					</span>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						fill="none"
						viewBox="0 0 24 24"
						strokeWidth={1.5}
						stroke="currentColor"
						className="shrink-0 h-4 w-4"
					>
						<path strokeLinecap="round" strokeLinejoin="round" d="M8.25 15 12 18.75 15.75 15m-7.5-6L12 5.25 15.75 9" />
					</svg>
				</button>
				{ hasFilters && (
					<button
						className="flex items-center justify-center w-4 h-4 rounded-full bg-gray-200 hover:bg-gray-300"
						title={ __( 'Clear filters', 'altis' ) }
						type="button"
						onClick={ e => {
							onUpdateFilter( {} );
							e.stopPropagation();
						} }
					>
						<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
							<path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
						</svg>
					</button>
				) }
			</div>
			<div className="flex items-center gap-2">
				<DropdownMenu
					className="Header__duration-dropdown"
					label="Select date duration"
					icon="clock"
					// @ts-ignore
					text={ dropdownText }
				>
					{ ( { onClose } ) => (
						<>
							<MenuGroup>
								{ Object.entries( TIME_FILTERS ).map( ( [ duration, name ] ) => (
									<MenuItem
										key={ duration }
										onClick={ onSelectItem( duration as Duration, onClose ) }
									>
										{ name }
									</MenuItem>

								) ) }
							</MenuGroup>
							<MenuGroup>
								<MenuItem onClick={ onSelectCustom( onClose ) }>
									{ __( 'Custom range', 'altis' ) }
								</MenuItem>
							</MenuGroup>
						</>
					) }
				</DropdownMenu>
				{ typeof period !== 'string' && (
					<div className="Header__picker">
						<DateRangePicker
							displayFormat="MMM D, Y"
							hideKeyboardShortcutsPanel
							isOutsideRange={ date => date.isAfter( now, 'day' ) }
							minDate={ undefined }
							maxDate={ moment( now ) }
							startDate={ period.start }
							startDateId="header_period_start"
							endDate={ period.end }
							endDateId="header_period_end"
							small
							verticalSpacing={ 12 }
							weekDayFormat="ddd"
							onDatesChange={ ( { startDate, endDate } ) => {
								if ( ! startDate || ! endDate ) {
									return;
								}
								props.onChangePeriod( {
									start: startDate.startOf( 'day' ),
									end: endDate.endOf( 'day' ),
								} );
							} }
							focusedInput={ focused }
							onFocusChange={ setFocused }
						/>
					</div>
				) }
				<div>
					<Button
						icon="update"
						onClick={ props.onRefresh }
					>
						{ __( 'Refresh', 'altis' ) }
					</Button>
				</div>
			</div>

			<FilterEditor
				nextFilter={ nextFilter }
				showingEditor={ showingEditor }
				onSetShowingEditor={ setShowingEditor }
				onUpdateFilter={ onUpdateFilter }
				onUpdateNextFilter={ setNextFilter }
			/>
		</header>
	);
}
