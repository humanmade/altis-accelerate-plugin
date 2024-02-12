import { __ } from '@wordpress/i18n';

import { PeriodObject } from '../utils/admin';

export const periods: PeriodObject[] = [
	{
		label: __( '7 Days', 'altis' ),
		period_label: __( '7-Day', 'altis' ),
		value: 'P7D',
		diff: 'P7D',
		defaultInterval: 1,
		intervals: [
			{ interval: '1 hour', label:  __( 'Hourly', 'altis' ), },
			{ interval: '1 day', label:  __( 'Daily', 'altis' ), },
		],
	},
	{
		label: __( '14 Days', 'altis' ),
		period_label: __( '14-Day', 'altis' ),
		value: 'P14D',
		diff: 'P14D',
		intervals: [
			{ interval: '1 day', label:  __( 'Daily', 'altis' ), },
		],
	},
	{
		label: __( '30 Days', 'altis' ),
		period_label: __( '30-Day', 'altis' ),
		value: 'P30D',
		diff: 'P30D',
		intervals: [
			{ interval: '1 day', label: __( 'Daily', 'altis' ), },
		],
	},
	{
		label: __( '90 Days', 'altis' ),
		period_label: __( '90-Day', 'altis' ),
		value: 'P90D',
		diff: null,
		intervals: [
			{ interval: '1 day', label: __( 'Daily', 'altis' ), },
			{ interval: '7 day', label: __( 'Weekly', 'altis' ), },
		],
	},
];
