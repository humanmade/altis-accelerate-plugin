import { useSelect } from '@wordpress/data';
import { sprintf } from '@wordpress/i18n';

import { cn } from '@/lib/utils';

const { Icon } = wp.components;
const { __ } = wp.i18n;

type TestConfig = {
	label: string;
	singular_label: string;
};

type ABTest = {
	started: boolean;
	paused: boolean;
	start_time: number;
	end_time: number;
	results: {
		winner: number | null;
		variants: Array<{ size: number; rate: number }>;
	};
};

// Known test type icons. Custom tests registered via register_post_ab_test()
// fall back to 'chart-line' (see line below in the render).
const TEST_ICONS: Record<string, string> = {
	titles: 'text',
	featured_images: 'format-image',
};

type StatusInfo = {
	label: string;
	dotClass: string;
};

const getTestStatus = ( test?: ABTest ): StatusInfo => {
	if ( ! test || ! test.started ) {
		return {
			label: __( 'Inactive', 'altis' ),
			dotClass: 'bg-gray-400',
		};
	}

	const now = Date.now();

	if ( test.results?.winner !== null ) {
		return {
			label: __( 'Winner', 'altis' ),
			dotClass: 'bg-brand',
		};
	}

	if ( test.paused ) {
		return {
			label: __( 'Paused', 'altis' ),
			dotClass: 'bg-amber-500',
		};
	}

	if ( test.start_time <= now && test.end_time >= now ) {
		return {
			label: __( 'Running', 'altis' ),
			dotClass: 'bg-green-500',
		};
	}

	return {
		label: __( 'Inactive', 'altis' ),
		dotClass: 'bg-gray-400',
	};
};

interface ExperimentChipsProps {
	expandedTestId: string | null;
	onToggle: ( testId: string | null ) => void;
}

export const ExperimentChips = ( { expandedTestId, onToggle }: ExperimentChipsProps ) => {
	const postABTests: Record<string, TestConfig> | undefined =
		window.Altis?.Analytics?.Experiments?.PostABTests;

	const abTests = useSelect(
		select => select( 'core/editor' ).getEditedPostAttribute( 'ab_tests' ) as Record<string, ABTest> | undefined,
		[]
	);

	if ( ! postABTests || Object.keys( postABTests ).length === 0 ) {
		return null;
	}

	const handleClick = ( testId: string ) => {
		if ( expandedTestId === testId ) {
			onToggle( null );
		} else {
			onToggle( testId );
		}
	};

	return (
		<>
			{ Object.keys( postABTests ).map( testId => {
				const test = abTests?.[ testId ];
				const status = getTestStatus( test as ABTest | undefined );
				const icon = TEST_ICONS[ testId ] || 'chart-line';
				const isExpanded = expandedTestId === testId;

				return (
					<button
						key={ testId }
						aria-expanded={ isExpanded }
						aria-label={ sprintf(
							/* translators: %s: experiment label, e.g. "Titles". */
							__( 'Toggle %s settings', 'altis' ),
							postABTests[ testId ].label
						) }
						className={ cn(
							'flex items-center gap-1.5 px-2 py-1 rounded cursor-pointer bg-transparent border-0 transition-colors text-gray-700 hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50',
							isExpanded && 'bg-gray-100'
						) }
						onClick={ () => handleClick( testId ) }
					>
						<Icon
							className={ cn(
								'transition-transform duration-200 fill-current',
								isExpanded ? 'rotate-0' : '-rotate-90'
							) }
							icon="arrow-down-alt2"
							size={ 14 }
						/>
						<Icon icon={ icon } size={ 16 } />
						<span className="!text-xs !font-medium text-foreground whitespace-nowrap">
							{ postABTests[ testId ].label }
						</span>
						<span className={ cn( 'w-1.5 h-1.5 rounded-full shrink-0', status.dotClass ) } />
						<span className="!text-xs text-muted-foreground">
							{ status.label }
						</span>
					</button>
				);
			} ) }
		</>
	);
};
