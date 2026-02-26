import React from 'react';

import { sprintf } from '@wordpress/i18n';

import { Post } from '../../types';

import { cn } from '@/lib/utils';

interface Props {
	children: React.ReactNode | null;
	className?: string;
	label: string;
	post: Post;
	onClick( post: Post ): void;
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
	<button
		aria-label={ sprintf( label, post.title.rendered ) }
		className={ cn(
			'inline bg-transparent border-0 p-0 cursor-pointer text-sm text-left w-auto',
			'text-foreground hover:underline hover:underline-offset-2',
			className
		) }
		type="button"
		onClick={ event => {
			event.preventDefault();
			onClick( post );
		} }
	>
		{ children || post.title.rendered }
	</button>
);

export default ActionLink;
