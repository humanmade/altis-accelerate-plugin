import React from 'react';

import { cx } from '../../lib/utils';

interface Props {
	children: React.ReactNode,
	className?: string,
}

export default function Block( props: Props ) {
	return (
		<div
			className={ cx( [
				// base
				"relative w-full rounded-lg border p-6 text-left shadow-sm",
				// background color
				"bg-white dark:bg-[#090E1A]",
				// border color
				"border-gray-200 dark:border-gray-900",
				props.className
			] ) }
		>
			{ props.children }
		</div>
	);
}
