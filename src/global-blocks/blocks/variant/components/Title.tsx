import { getLetter } from "../../../../utils";
import { ReactNode } from 'react';

import { useSelect} from '@wordpress/data';
import { __, sprintf } from '@wordpress/i18n';
import { decodeEntities } from "@wordpress/html-entities";

interface Variant {
	audience?: number;
	title?: string;
	fallback?: boolean;
}

interface Audience {
	id: number;
	error?: {
		message: string;
	};
	title: {
		raw?: string;
		rendered: string;
	};
	status: 'publish' | 'draft' | 'auto-draft' | 'trash';
	menu_order: number;
	slug: string;
}

interface AudienceSelect {
	getPost: (id?: number) => Audience | undefined;
	getIsLoading: () => boolean;
}

interface TitleProps {
	index: number;
	placeholder?: string | null;
	type: 'abtest' | string;
	variant: Variant | null | undefined;
}

/**
 * Component for fetching and displaying the variant title string.
 *
 * @param props The component props.
 * @param props.index The index of the variant.
 * @param props.variant The variant block object.
 * @param props.placeholder Optional placeholder text for the variant title.
 * @param props.type The type of variant (e.g., 'abtest').
 * @returns The title to show for the variant.
 */
const Title = ({ index, placeholder = null, type, variant }: TitleProps): ReactNode => {
	let hasVariant = true;
	if (!variant || typeof variant !== 'object') {
		variant = {};
		hasVariant = false;
	}

	const audience = useSelect((select: (storeName: string) => AudienceSelect) => {
		return select('audience').getPost(variant.audience);
	}, [variant.audience]);

	const isLoading = useSelect((select: (storeName: string) => AudienceSelect) => {
		return select('audience').getIsLoading();
	}, []);

	if (!hasVariant) {
		return '';
	}

	if (variant?.title) {
		return decodeEntities(variant.title);
	}

	if (type === 'abtest') {
		if (index === 0) {
			return sprintf(__('Variant %s (Original)', 'altis'), getLetter(index));
		}
		return sprintf(__('Variant %s', 'altis'), getLetter(index));
	}

	if (variant.fallback) {
		return __('Fallback', 'altis');
	}

	if (!variant.audience) {
		if (placeholder) {
			return decodeEntities(placeholder);
		}
		return __('Select audience', 'altis');
	}

	const status = (audience && audience.status) || 'draft';
	const title = audience && audience.title && audience.title.rendered;

	// Audience is valid and has a title.
	if (status !== 'trash' && title) {
		return decodeEntities(audience.title.rendered);
	}

	// Audience has been deleted.
	if (status === 'trash') {
		return __('(deleted)', 'altis');
	}

	// Check if audience response is a REST API error.
	if (audience && audience.error && audience.error.message) {
		return audience.error.message;
	}

	if (isLoading) {
		return __('Loading...', 'altis');
	}

	return '';
};

export default Title;
