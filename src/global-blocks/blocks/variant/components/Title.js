import { getLetter } from "../../../../utils";

const { useSelect } = wp.data;
const { __, sprintf } = wp.i18n;
const { decodeEntities } = wp.htmlEntities;

/**
 * Component for fetching and displaying the variant title string.
 *
 * @param {React.ComponentProps} props The component props.
 * @param {object} props.variant The variant block object.
 * @param {string} props.placeholder Optional placeholder text for the variant title.
 * @returns {React.ReactNode} The title to show for the variant.
 */
const Title = ( { index, placeholder = null, type, variant } ) => {
	let hasVariant = true;
	if ( ! variant || typeof variant !== 'object' ) {
		variant = {};
		hasVariant = false;
	}

	const audience = useSelect( select => {
		return select( 'audience' ).getPost( variant.audience );
	}, [ variant.audience ] );

	const isLoading = useSelect( select => select( 'audience' ).getIsLoading(), [] );

	if ( ! hasVariant ) {
		return '';
	}

	if ( variant?.title ) {
		return decodeEntities( variant.title );
	}

	if ( type === 'abtest' ) {
		if ( index === 0 ) {
			return sprintf( __( 'Variant %s (Original)', 'altis' ), getLetter( index ) );
		}
		return sprintf( __( 'Variant %s', 'altis' ), getLetter( index ) );
	}

	if ( variant.fallback ) {
		return __( 'Fallback', 'altis' );
	}

	if ( ! variant.audience ) {
		if ( placeholder ) {
			return decodeEntities( placeholder );
		}
		return __( 'Select audience', 'altis' );
	}

	const status = ( audience && audience.status ) || 'draft';
	const title = audience && audience.title && audience.title.rendered;

	// Audience is valid and has a title.
	if ( status !== 'trash' && title ) {
		return decodeEntities( audience.title.rendered );
	}

	// Audience has been deleted.
	if ( status === 'trash' ) {
		return __( '(deleted)', 'altis' );
	}

	// Check if audience reponse is a REST API error.
	if ( audience && audience.error && audience.error.message ) {
		return audience.error.message;
	}

	if ( isLoading ) {
		return __( 'Loading...', 'altis' );
	}

	return '';
};

export default Title;
