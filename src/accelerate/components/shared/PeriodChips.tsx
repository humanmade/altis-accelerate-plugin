import { __ } from '@wordpress/i18n';

export type Period = 'P7D' | 'P30D' | 'P90D';

const PERIODS: Period[] = [ 'P7D', 'P30D', 'P90D' ];

export interface PeriodChipsProps {
	value: Period;
	onChange: ( value: Period ) => void;
}

export const PeriodChips = ( { value, onChange }: PeriodChipsProps ) => {
	return (
		<div className="flex gap-2 text-gray-500 items-center font-sans">
			{ PERIODS.map( p => (
				<button
					key={ p }
					aria-pressed={ p === value }
					className={ `relative font-sans ${ p === value ? 'text-gray-800 font-bold' : 'text-gray-600' }` }
					type="button"
					onClick={ () => onChange( p ) }
					// Native button preserves the original tight density (no WP Button padding)
				>
					<span aria-hidden="true" className="invisible font-bold">
						{ p.replace( 'P', '' ) }
					</span>
					<span className={ `absolute inset-0 flex items-center justify-center ${ p === value ? 'font-bold' : 'font-normal' }` }>
						{ p.replace( 'P', '' ) }
					</span>
				</button>
			) ) }
		</div>
	);
};
