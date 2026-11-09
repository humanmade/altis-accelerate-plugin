import { __ } from '@wordpress/i18n';

import type { ColumnDef } from '@/components/DataTable';

export const EXPERIMENT_COLUMNS: ColumnDef[] = [
	{
		headerClass: 'thumbnail',
		label: '\u00A0',
	},
	{
		headerClass: 'name',
		label: '\u00A0',
	},
	{
		headerClass: 'traffic',
		label: __( 'Conv. Rate', 'altis' ),
	},
	{
		headerClass: 'lift',
		label: __( 'Lift', 'altis' ),
	},
	{
		headerClass: 'meta',
		label: __( 'Actions', 'altis' ),
	},
];
