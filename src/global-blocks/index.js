import { registerBlockType } from '@wordpress/blocks';
import { register } from '@wordpress/data';
import { addFilter } from '@wordpress/hooks';
import { registerPlugin } from '@wordpress/plugins';

import { store } from '../data';
import * as RelationshipsPlugin from './plugins/relationships';

import * as BlockPicker from './blocks/block-picker';
import * as StaticGlobalBlock from './blocks/static-global';
import * as GlobalBlock from './blocks/global';
import * as Variant from './blocks/variant';

import pluginSettings from './settings';

import './styles.scss';

const { context } = pluginSettings;

const { postType } = context;

// Set up redux store.
register( store );

if ( postType === 'wp_block' ) {
	registerPlugin( RelationshipsPlugin.name, RelationshipsPlugin.settings );
	registerPlugin( GlobalBlock.Plugin.name, GlobalBlock.Plugin.settings );
}

addFilter(
	'blocks.registerBlockType',
	'accelerate/global-block/settings',
	GlobalBlock.withGlobalBlockSettings
);

addFilter(
	'editor.BlockEdit',
	'accelerate/global-block/controls',
	GlobalBlock.withAccelerateControls
);

registerBlockType( BlockPicker.name, BlockPicker.options );
registerBlockType( StaticGlobalBlock.name, StaticGlobalBlock.options );
registerBlockType( Variant.name, Variant.options );
