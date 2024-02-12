const { __ } = wp.i18n;

export const STRING_OPERATIONS = {
	'=': __( 'is', 'altis' ),
	'!=': __( 'is not', 'altis' ),
	'*=': __( 'contains', 'altis' ),
	'!*': __( 'does not contain', 'altis' ),
	'^=': __( 'begins with', 'altis' ),
};

export const NUMERIC_OPERATIONS = {
	'=': __( 'is', 'altis' ),
	'!=': __( 'is not', 'altis' ),
	'gt': __( 'is greater than', 'altis' ),
	'gte': __( 'is greater than or equal to', 'altis' ),
	'lt': __( 'is less than', 'altis' ),
	'lte': __( 'is less than or equal to', 'altis' ),
};
