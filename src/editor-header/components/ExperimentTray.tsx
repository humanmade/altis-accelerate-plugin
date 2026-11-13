import React, { useRef } from 'react';

import { useSelect } from '@wordpress/data';

import { context, getSidebarTests } from '../../experiments/data';

import { ExperimentTrayResults } from './ExperimentTrayResults';
import { ExperimentTraySettings } from './ExperimentTraySettings';

const { Provider: ContextProvider } = context;

interface ExperimentTrayProps {
	expandedTestId: string | null;
}

export const ExperimentTray = ( { expandedTestId }: ExperimentTrayProps ) => {
	const tests = getSidebarTests();
	const activeTest = expandedTestId ? tests[ expandedTestId ] : null;

	// Keep a ref to the last rendered test so content stays visible during collapse.
	const lastTestRef = useRef( activeTest );
	if ( activeTest ) {
		lastTestRef.current = activeTest;
	}
	const renderedTest = activeTest || lastTestRef.current;

	const abTests = useSelect(
		select => select( 'core/editor' ).getEditedPostAttribute( 'ab_tests' ) as Record<string, any> | undefined,
		[]
	);

	const currentPost = useSelect(
		select => select( 'core/editor' ).getCurrentPost() as { id: number },
		[]
	);

	// Opt the editing user out of the active test (same as panel.js).
	if ( activeTest && currentPost?.id ) {
		const stored = JSON.parse( window.localStorage.getItem( '_altis_ab_tests' ) || '{}' );
		stored[ `${ activeTest.id }_${ currentPost.id }` ] = false;
		window.localStorage.setItem( '_altis_ab_tests', JSON.stringify( stored ) );
	}

	// Determine whether to show settings or results for the rendered test.
	const renderedId = renderedTest?.id;
	const testData = renderedId && abTests?.[ renderedId ];
	const hasEnded = testData && ( testData.end_time < Date.now() || testData.ended );
	const hasWinner = testData?.results?.winner !== null && testData?.results?.winner !== undefined;
	const showResults = hasWinner || hasEnded;

	return (
		<div
			className={ `grid transition-[grid-template-rows] duration-300 ease-out ${ expandedTestId ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]' }` }
			style={ { backgroundColor: '#f8f8f8' } }
		>
			<div className="overflow-hidden">
				{ renderedTest && (
					<div className="p-3 pl-[80px]">
						<ContextProvider value={ renderedTest }>
							{ showResults ? (
								<ExperimentTrayResults />
							) : (
								<ExperimentTraySettings />
							) }
						</ContextProvider>
					</div>
				) }
			</div>
		</div>
	);
};
