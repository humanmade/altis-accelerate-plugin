import React from 'react';

import { Skeleton } from '@/components/ui/skeleton';

/**
 * Audience list loading component.
 */
const ListRowLoading = () => (
	<div className="flex items-center py-4 border-b border-border">
		<div className="w-12 shrink-0">
		</div>
		<div className="flex-1 min-w-0">
			<Skeleton className="h-3 w-48 mb-2" />
			<Skeleton className="h-2 w-12" />
		</div>
		<div className="w-48 shrink-0">
			<Skeleton className="h-2 w-24" />
		</div>
		<div className="w-32 shrink-0">
			<Skeleton className="h-2 w-16" />
		</div>
	</div>
);

export default ListRowLoading;
