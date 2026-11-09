import { useSelect, useDispatch } from '@wordpress/data';

const { Icon } = wp.components;
const { __ } = wp.i18n;

type TestConfig = {
	label: string;
	singular_label: string;
};

const TEST_ICONS: Record<string, string> = {
	titles: 'editor-textcolor',
	featured_images: 'format-image',
};

export const ExperimentIndicators = () => {
	const postABTests: Record<string, TestConfig> | undefined =
		window.Altis?.Analytics?.Experiments?.PostABTests;

	const abTests = useSelect(
		select => select( 'core/editor' ).getEditedPostAttribute( 'ab_tests' ) as Record<string, ABTest> | undefined,
		[]
	);

	const { openGeneralSidebar } = useDispatch( 'core/edit-post' );

	if ( ! postABTests || Object.keys( postABTests ).length === 0 ) {
		return null;
	}

	const handleClick = () => {
		openGeneralSidebar( 'altis-analytics/altis-experiments' );
	};

	const now = Date.now();

	return (
		<>
			{ Object.keys( postABTests ).map( testId => {
				const test = abTests?.[ testId ];
				const isActive = Boolean(
					test &&
					test.started &&
					! test.paused &&
					test.start_time <= now &&
					test.end_time >= now &&
					test.results?.winner === null
				);

				const icon = TEST_ICONS[ testId ] || 'chart-line';

				return (
					<button
						key={ testId }
						className={ `flex items-center p-1 rounded cursor-pointer bg-transparent border-0 transition-colors hover:bg-gray-100 ${
							isActive ? 'text-brand' : 'text-gray-400'
						}` }
						title={ `${ postABTests[ testId ].label } — ${ isActive ? __( 'Running', 'altis' ) : __( 'Inactive', 'altis' ) }` }
						onClick={ handleClick }
					>
						<Icon icon={ icon } size={ 20 } />
					</button>
				);
			} ) }
		</>
	);
};
