import { useSelect } from '@wordpress/data';
import { PluginDocumentSettingPanel } from '@wordpress/editor';

import { AdvancedControls } from './components/AdvancedControls';

const PluginSidebar = () => {
	const post = useSelect( select => {
		return select( 'core/editor' ).getCurrentPost();
	} );

	if ( post.type !== 'wp_block' ) {
		return null;
	}

	return (
		<AdvancedControls
			blockPost={ post }
			wrapper={ ( { children, title, icon = null }, index ) => (
				<PluginDocumentSettingPanel
					key={ index }
					icon={ icon }
					name={ `accelerate-block-settings-panel-${ index }` }
					title={ title }
				>
					{ children }
				</PluginDocumentSettingPanel>
			) }
		/>
	);
};

export const Plugin = {
	name: 'accelerate-block-panels',
	settings: {
		render: PluginSidebar,
	},
};
