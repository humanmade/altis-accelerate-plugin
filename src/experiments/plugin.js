import React, { Fragment } from 'react';

import { useSelect } from '@wordpress/data';
import TestPanel from './components/panel';
import { context, getSidebarTests } from './data';

const {
	PluginSidebar,
	PluginSidebarMoreMenuItem,
} = wp.editPost;
const { __ } = wp.i18n;

/**
 * Block Editor sidebar plugin component for A/B tests.
 *
 * @return {React.ReactNode} The plugin sidebar.
 */
const Plugin = () => {
	const tests = getSidebarTests();
	const { Provider: ContextProvider } = context;

	// Don't render the plugin if we're editing a synced pattern.
	const postType = useSelect((select) => select('core/editor').getCurrentPostType(), []);

	if ( postType === 'wp_block' ) {
		return null;
	}

	// Short circuit early if no panels are defined, to disable the sidebar completely.
	if ( tests.length < 1 ) {
		// eslint-disable-next-line
		console.warn( 'Could not find any registered tests with sidebar UI.' );
		return ( <></> );
	}

	return (
		<Fragment>
			<PluginSidebarMoreMenuItem
				target="altis-experiments"
			>
				{ __( 'Experiments', 'altis' ) }
			</PluginSidebarMoreMenuItem>
			<PluginSidebar
				name="altis-experiments"
				title={ __( 'Experiments', 'altis' ) }
			>
				{ tests && Object.keys( tests ).map( id => (
					<ContextProvider key={ id } value={ tests[ id ] }>
						<TestPanel />
					</ContextProvider>
				) ) }
			</PluginSidebar>
		</Fragment>
	);
};

export default Plugin;
