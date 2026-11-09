import React from 'react';

import '@/accelerate/components/List.scss';

export interface ColumnDef {
	/** Suffix for table-header-* class (e.g. "thumbnail", "name", "traffic", "lift", "meta") */
	headerClass: string;
	/** Column header content. Use '\u00A0' for visually-empty headers. */
	label: React.ReactNode;
}

interface DataTableProps {
	columns: ColumnDef[];
	children: React.ReactNode;
	/** Toolbar / filters rendered inside .table-wrap above the table. */
	controls?: React.ReactNode;
	/** Shown inside <tbody> when there are no row children. Wrapped in a full-width <tr><td>. */
	emptyContent?: React.ReactNode;
	/** Pagination or actions rendered in .table-footer after the table. */
	footer?: React.ReactNode;
	className?: string;
}

export function DataTable( {
	columns,
	children,
	controls,
	emptyContent,
	footer,
	className = '',
}: DataTableProps ) {
	const hasRows = React.Children.count( children ) > 0;

	return (
		<div className={ `List tailwind ${ className }`.trim() }>
			<div className="table-wrap">
				{ controls }
				<div className="table-content">
					<table>
						<thead>
							<tr>
								{ columns.map( col => (
									<th key={ col.headerClass } className={ `table-header-${ col.headerClass }` }>
										{ col.label }
									</th>
								) ) }
							</tr>
						</thead>
						<tbody aria-live="polite">
							{ hasRows ? children : (
								emptyContent && (
									<tr>
										<td colSpan={ columns.length }>
											{ emptyContent }
										</td>
									</tr>
								)
							) }
						</tbody>
					</table>
					{ footer && (
						<div className="table-footer">
							{ footer }
						</div>
					) }
				</div>
			</div>
		</div>
	);
}
