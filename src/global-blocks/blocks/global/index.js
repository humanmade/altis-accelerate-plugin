import { PluginDocumentSettingPanel } from '@wordpress/edit-post';

import { useSelect } from '@wordpress/data';
import { __, _n } from '@wordpress/i18n';

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
					name={ `accelerate-block-settings-panel-${ index }` }
					title={ title }
					icon={ icon }
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
