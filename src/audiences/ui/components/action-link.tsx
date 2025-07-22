import { Button } from '@wordpress/components';
import { sprintf } from '@wordpress/i18n';
import React from 'react';

import { Post } from '../../types';

interface Props {
	children: React.ReactChildren | null;
	className: string;
	label: string;
	post: Post;
	onClick( post: Post ) : void;
}

/**
 * Action Link Component.
 */
const ActionLink = ( {
	children = null,
	className = '',
	label,
	post,
	onClick,
}: Props ): React.ReactNode => (
	<Button
		aria-label={ sprintf( label, post.title.rendered ) }
		className={ className }
		isLink
		onClick={ event => {
			event.preventDefault();
			onClick( post );
		} }
	>
		{ children || post.title.rendered }
	</Button>
);

export default ActionLink;
