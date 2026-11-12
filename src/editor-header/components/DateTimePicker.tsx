import { CalendarIcon } from 'lucide-react';
import React, { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';

interface DateTimePickerProps {
	value: number;
	onChange: ( timestamp: number ) => void;
}

const pad = ( n: number ) => String( n ).padStart( 2, '0' );

const formatDate = ( timestamp: number ): string => {
	const d = new Date( timestamp );
	return `${ d.getFullYear() }-${ pad( d.getMonth() + 1 ) }-${ pad( d.getDate() ) } ${ pad( d.getHours() ) }:${ pad( d.getMinutes() ) }`;
};

const clamp = ( val: number, min: number, max: number ) => Math.min( Math.max( val, min ), max );

export const DateTimePicker = ( { value, onChange }: DateTimePickerProps ) => {
	const [ open, setOpen ] = useState( false );
	const date = new Date( value );

	const handleDaySelect = ( day: Date | undefined ) => {
		if ( ! day ) return;
		const updated = new Date( value );
		updated.setFullYear( day.getFullYear(), day.getMonth(), day.getDate() );
		onChange( updated.getTime() );
	};

	const handleHourChange = ( e: React.ChangeEvent<HTMLInputElement> ) => {
		const updated = new Date( value );
		updated.setHours( clamp( Number( e.target.value ), 0, 23 ) );
		onChange( updated.getTime() );
	};

	const handleMinuteChange = ( e: React.ChangeEvent<HTMLInputElement> ) => {
		const updated = new Date( value );
		updated.setMinutes( clamp( Number( e.target.value ), 0, 59 ) );
		onChange( updated.getTime() );
	};

	return (
		<Popover open={ open } onOpenChange={ setOpen }>
			<PopoverTrigger asChild>
				<Button
					className={ cn(
						'!h-7 !px-2 !text-xs !font-normal gap-1.5',
						! value && 'text-muted-foreground'
					) }
					variant="outline"
				>
					<CalendarIcon className="h-3 w-3" />
					{ formatDate( value ) }
				</Button>
			</PopoverTrigger>
			<PopoverContent align="start" className="w-auto p-0">
				<Calendar
					mode="single"
					selected={ date }
					onSelect={ handleDaySelect }
				/>
				<div className="flex items-center gap-1.5 px-3 pb-3 border-t border-border pt-2">
					<input
						className="!w-12 !rounded-md !border !border-border !bg-background !px-1.5 !py-0.5 !text-xs text-center focus:!outline-none focus:!ring-1 focus:!ring-ring"
						max={ 23 }
						min={ 0 }
						type="number"
						value={ pad( date.getHours() ) }
						onChange={ handleHourChange }
					/>
					<span className="!text-sm text-muted-foreground">:</span>
					<input
						className="!w-12 !rounded-md !border !border-border !bg-background !px-1.5 !py-0.5 !text-xs text-center focus:!outline-none focus:!ring-1 focus:!ring-ring"
						max={ 59 }
						min={ 0 }
						type="number"
						value={ pad( date.getMinutes() ) }
						onChange={ handleMinuteChange }
					/>
				</div>
			</PopoverContent>
		</Popover>
	);
};
