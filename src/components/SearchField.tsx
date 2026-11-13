import { Search, X } from 'lucide-react';
import * as React from 'react';

import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface SearchFieldProps {
	placeholder?: string;
	className?: string;
	debounce?: number;
	onChange: ( value: string ) => void;
}

export function SearchField( {
	placeholder = 'Search...',
	className,
	debounce = 500,
	onChange,
}: SearchFieldProps ) {
	const [ value, setValue ] = React.useState( '' );
	const timerRef = React.useRef<ReturnType<typeof setTimeout>>();

	const handleChange = ( e: React.ChangeEvent<HTMLInputElement> ) => {
		const next = e.target.value;
		setValue( next );
		if ( timerRef.current ) {
			clearTimeout( timerRef.current );
		}
		timerRef.current = setTimeout( () => onChange( next ), debounce );
	};

	const handleClear = () => {
		setValue( '' );
		if ( timerRef.current ) {
			clearTimeout( timerRef.current );
		}
		onChange( '' );
	};

	return (
		<div className={ cn( 'relative w-80 max-w-full', className ) }>
			<Search className="absolute left-3 top-1/2 !h-4 !w-4 -translate-y-1/2 text-muted-foreground" />
			<Input
				className="w-full !pl-9 !pr-9"
				placeholder={ placeholder }
				value={ value }
				onChange={ handleChange }
			/>
			{ value && (
				<button
					className="absolute right-3 top-1/2 -translate-y-1/2 rounded-sm p-0 border-0 bg-transparent text-muted-foreground hover:text-foreground cursor-pointer"
					type="button"
					onClick={ handleClear }
				>
					<X className="!h-4 !w-4" />
					<span className="sr-only">Clear</span>
				</button>
			) }
		</div>
	);
}
