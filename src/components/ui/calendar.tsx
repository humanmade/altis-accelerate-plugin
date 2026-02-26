import { ChevronLeft, ChevronRight } from 'lucide-react';
import * as React from 'react';
import { DayPicker } from 'react-day-picker';

import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

function Calendar( {
	className,
	classNames,
	showOutsideDays = true,
	...props
}: CalendarProps ) {
	return (
		<DayPicker
			className={ cn( 'p-3', className ) }
			classNames={ {
				months: 'flex gap-4',
				month: 'flex flex-col gap-4',
				month_caption: 'flex justify-center pt-1 relative items-center h-7',
				caption_label: 'text-sm font-medium',
				nav: 'flex items-center gap-1',
				button_previous: cn(
					buttonVariants( { variant: 'outline' } ),
					'absolute left-1 h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100'
				),
				button_next: cn(
					buttonVariants( { variant: 'outline' } ),
					'absolute right-1 h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100'
				),
				month_grid: 'w-full border-collapse',
				weekdays: 'flex',
				weekday: 'text-muted-foreground rounded-md w-8 font-normal text-[0.8rem] text-center',
				week: 'flex w-full mt-2',
				day: 'relative p-0 text-center text-sm focus-within:relative focus-within:z-20',
				day_button: cn(
					buttonVariants( { variant: 'ghost' } ),
					'h-8 w-8 p-0 font-normal aria-selected:opacity-100'
				),
				range_start: 'day-range-start rounded-l-md',
				range_end: 'day-range-end rounded-r-md',
				selected: 'bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground rounded-md',
				today: 'bg-accent text-accent-foreground rounded-md',
				outside: 'text-muted-foreground opacity-50',
				disabled: 'text-muted-foreground opacity-50',
				range_middle: 'aria-selected:bg-accent aria-selected:text-accent-foreground',
				hidden: 'invisible',
				...classNames,
			} }
			components={ {
				Chevron: ( { orientation } ) => {
					const Icon = orientation === 'left' ? ChevronLeft : ChevronRight;
					return <Icon className="h-4 w-4" />;
				},
			} }
			showOutsideDays={ showOutsideDays }
			{ ...props }
		/>
	);
}
Calendar.displayName = 'Calendar';

export { Calendar };
