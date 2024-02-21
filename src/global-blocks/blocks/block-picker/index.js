import { __ } from '@wordpress/i18n';

import Edit from './Edit';
import { GlobalBlockIcon } from '../../utils/icons';

export const name = 'altis/block-picker';

export const options = {
	category: 'common',
	description: __(
		'Create content, and save it for you and other contributors to reuse across your site.',
		'altis',
	),
	edit: Edit,
	icon: GlobalBlockIcon,
	save: () => null,
	title: __( 'Synced Pattern', 'altis' ),
	supports: {
		customClassName: false,
		html: false,
		reusable: false,
	},
};
