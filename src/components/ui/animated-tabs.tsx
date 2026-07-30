import * as React from 'react';

import { cn } from '@/lib/utils';

interface TabOption<T extends string> {
	value: T;
	label: React.ReactNode;
}

interface AnimatedTabsProps<T extends string> {
	options: TabOption<T>[];
	value: T;
	onValueChange: ( value: T ) => void;
	className?: string;
}

function AnimatedTabs<T extends string>( {
	options,
	value,
	onValueChange,
	className,
}: AnimatedTabsProps<T> ) {
	const containerRef = React.useRef<HTMLDivElement>( null );
	const [ indicatorStyle, setIndicatorStyle ] = React.useState( {
		width: 0,
		left: 0,
	} );

	// Update indicator position when value changes
	React.useEffect( () => {
		if ( ! containerRef.current ) {
			return;
		}

		const activeIndex = options.findIndex( opt => opt.value === value );
		if ( activeIndex === -1 ) {
			return;
		}

		const buttons = containerRef.current.querySelectorAll( 'button' );
		const activeButton = buttons[ activeIndex ] as HTMLButtonElement;

		if ( activeButton ) {
			setIndicatorStyle( {
				width: activeButton.offsetWidth,
				left: activeButton.offsetLeft,
			} );
		}
	}, [ value, options ] );

	// Also update on mount and resize
	React.useEffect( () => {
		const updateIndicator = () => {
			if ( ! containerRef.current ) {
				return;
			}

			const activeIndex = options.findIndex( opt => opt.value === value );
			if ( activeIndex === -1 ) {
				return;
			}

			const buttons = containerRef.current.querySelectorAll( 'button' );
			const activeButton = buttons[ activeIndex ] as HTMLButtonElement;

			if ( activeButton ) {
				setIndicatorStyle( {
					width: activeButton.offsetWidth,
					left: activeButton.offsetLeft,
				} );
			}
		};

		// Initial update after render
		const timer = setTimeout( updateIndicator, 0 );

		window.addEventListener( 'resize', updateIndicator );
		return () => {
			clearTimeout( timer );
			window.removeEventListener( 'resize', updateIndicator );
		};
	}, [ options, value ] );

	return (
		<div
			ref={ containerRef }
			className={ cn(
				'relative inline-flex !h-9 items-center justify-center !rounded-lg !bg-muted !p-1 text-muted-foreground',
				className
			) }
		>
			{ /* Sliding indicator */ }
			<div
				className="absolute !h-7 !rounded-md !bg-background shadow transition-all duration-200 ease-[cubic-bezier(0.2,0,0,1)]"
				style={ {
					width: indicatorStyle.width,
					left: indicatorStyle.left,
					top: '50%',
					transform: 'translateY(-50%)',
				} }
			/>

			{ /* Tab buttons */ }
			{ options.map( option => (
				<button
					key={ option.value }
					className={ cn(
						'relative z-10 inline-flex items-center justify-center whitespace-nowrap !rounded-md !px-3 !py-1 !text-sm !font-medium transition-colors duration-200 ease-[cubic-bezier(0.2,0,0,1)] !border-0 !bg-transparent !shadow-none',
						'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
						value === option.value
							? '!text-foreground'
							: '!text-muted-foreground hover:!text-foreground'
					) }
					type="button"
					onClick={ () => onValueChange( option.value ) }
				>
					{ option.label }
				</button>
			) ) }
		</div>
	);
}

export { AnimatedTabs };
export type { TabOption };
