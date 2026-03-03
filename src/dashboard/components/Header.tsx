import { format } from 'date-fns';
import { ChevronsUpDown, ChevronDown, X, RefreshCw, CalendarIcon } from 'lucide-react';
import moment from 'moment';
import React, { useState } from 'react';
import { DateRange } from 'react-day-picker';

import { __ } from '@wordpress/i18n';

import { Duration, Filter, SelectableDate } from '../../utils/admin';

import FilterEditor from './FilterEditor';
import FilterSummary from './FilterSummary';

import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from '@/components/ui/popover';

const TIME_FILTERS = {
	'PT30M': __( 'Realtime', 'altis' ),
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
	const [ calendarOpen, setCalendarOpen ] = useState( false );
	const [ pendingRange, setPendingRange ] = useState<DateRange | undefined>( undefined );

	const now = new Date();

	const onSelectItem = ( period: SelectableDate ) => () => {
		props.onChangePeriod( period );
	};
	const onSelectCustom = () => {
		props.onChangePeriod( {
			start: moment( now ).startOf( 'week' ),
			end: moment( now ).endOf( 'day' ),
		} );
	};
	const onOpenFilters = () => {
		setNextFilter( filter );
		setShowingEditor( true );
	};

	const hasFilters = !! filter.path || !! filter.audience;
	const dropdownText = typeof period !== 'string' ? __( 'Custom range', 'altis' ) : TIME_FILTERS[ period ];

	return (
		<div className="tailwind">
			<header
				className="-mt-4 mb-6 mx-2 lg:mx-16 md:mx-4 flex items-center justify-between gap-4"
			>
				<div className="grow flex items-center gap-2">
					<Button
						className="w-full justify-between gap-2"
						variant="outline"
						onClick={ onOpenFilters }
					>
						<span className={ `grow w-[400px] text-left overflow-hidden text-ellipsis ${ hasFilters ? 'text-foreground' : 'text-muted-foreground' }` }>
							<FilterSummary
								filter={ filter }
							/>
						</span>
						<ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
					</Button>
					{ hasFilters && (
						<Button
							className="h-6 w-6 rounded-full"
							size="icon"
							title={ __( 'Clear filters', 'altis' ) }
							variant="ghost"
							onClick={ e => {
								onUpdateFilter( {} );
								e.stopPropagation();
							} }
						>
							<X className="h-4 w-4" />
						</Button>
					) }
				</div>
				<div className="flex items-center gap-2">
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button variant="outline">
								{ dropdownText || __( 'Select period', 'altis' ) }
								<ChevronDown className="ml-2 h-4 w-4 opacity-50" />
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent>
							{ Object.entries( TIME_FILTERS ).map( ( [ duration, name ] ) => (
								<DropdownMenuItem
									key={ duration }
									onClick={ onSelectItem( duration as Duration ) }
								>
									{ name }
								</DropdownMenuItem>
							) ) }
							<DropdownMenuSeparator />
							<DropdownMenuItem onClick={ onSelectCustom }>
								{ __( 'Custom range', 'altis' ) }
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
					{ typeof period !== 'string' && (
						<Popover
							open={ calendarOpen }
							onOpenChange={ open => {
								if ( open ) {
									// Initialize pending range from current period when opening
									setPendingRange( {
										from: period.start?.toDate(),
										to: period.end?.toDate(),
									} );
								}
								setCalendarOpen( open );
							} }
						>
							<PopoverTrigger asChild>
								<Button variant="outline">
									<CalendarIcon className="mr-2 h-4 w-4" />
									{ period.start && period.end ? (
										<>
											{ format( period.start.toDate(), 'LLL dd, y' ) } -{ ' ' }
											{ format( period.end.toDate(), 'LLL dd, y' ) }
										</>
									) : (
										<span>{ __( 'Pick a date range', 'altis' ) }</span>
									) }
								</Button>
							</PopoverTrigger>
							<PopoverContent align="end" className="w-auto p-0">
								<Calendar
									defaultMonth={ period.start?.toDate() }
									disabled={ { after: now } }
									mode="range"
									numberOfMonths={ 2 }
									selected={ pendingRange }
									onSelect={ setPendingRange }
								/>
								<div className="border-t border-border p-3 flex items-center justify-between gap-4">
									<p className="text-sm text-muted-foreground">
										{ pendingRange?.from && pendingRange?.to ? (
											<>
												{ format( pendingRange.from, 'LLL dd' ) } – { format( pendingRange.to, 'LLL dd, y' ) }
											</>
										) : pendingRange?.from ? (
											<>{ __( 'Select end date', 'altis' ) }</>
										) : (
											<>{ __( 'Select start date', 'altis' ) }</>
										) }
									</p>
									<Button
										disabled={ ! pendingRange?.from || ! pendingRange?.to }
										size="sm"
										onClick={ () => {
											if ( pendingRange?.from ) {
												props.onChangePeriod( {
													start: moment( pendingRange.from ).startOf( 'day' ),
													end: moment( pendingRange.to || pendingRange.from ).endOf( 'day' ),
												} );
												setCalendarOpen( false );
											}
										} }
									>
										{ __( 'Apply Range', 'altis' ) }
									</Button>
								</div>
							</PopoverContent>
						</Popover>
					) }
					<Button
						variant="outline"
						onClick={ props.onRefresh }
					>
						<RefreshCw className="h-4 w-4 mr-2" />
						{ __( 'Refresh', 'altis' ) }
					</Button>
				</div>

				<FilterEditor
					nextFilter={ nextFilter }
					showingEditor={ showingEditor }
					onSetShowingEditor={ setShowingEditor }
					onUpdateFilter={ onUpdateFilter }
					onUpdateNextFilter={ setNextFilter }
				/>
			</header>
		</div>
	);
}
