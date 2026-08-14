import React from 'react';

import { EXPERIMENT_COLUMNS } from './columns';

import { DataTable } from '@/components/DataTable';
import { Skeleton } from '@/components/ui/skeleton';

export function ExperimentRowSkeleton() {
	const rows = Array.from( { length: 5 } );

	return (
		<DataTable columns={ EXPERIMENT_COLUMNS }>
			{ rows.map( ( _, i ) => (
				<tr key={ i } className="record-placeholder">
					<td className="record-thumbnail">
						<Skeleton style={ {
							width: 105,
							height: 47,
						} } />
					</td>
					<td className="record-name">
						<Skeleton className="h-1.5 w-[170px] mb-2" />
						<div className="flex gap-2">
							<Skeleton className="h-1.5 w-[90px]" />
							<Skeleton className="h-1.5 w-[50px]" />
						</div>
					</td>
					<td className="record-traffic">
						<div className="flex flex-col gap-1">
							<Skeleton className="h-1.5 w-[48px]" />
							<Skeleton className="h-1.5 w-[58px]" />
						</div>
					</td>
					<td className="record-lift">&nbsp;</td>
					<td className="record-meta">
						<div className="flex flex-col gap-1">
							<Skeleton className="h-1.5 w-[70px]" />
						</div>
					</td>
				</tr>
			) ) }
		</DataTable>
	);
}
