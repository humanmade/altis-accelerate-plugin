import { Skeleton } from '@/components/ui/skeleton';

type Props = {
	i: number,
	isNestable?: boolean,
};

const ListItemPlaceholder = function ( props: Props ) {
	const {
		i,
		isNestable = false,
	} = props;

	return (
		<tr key={ `placeholder-${ i }` } className="record-placeholder">
			{ isNestable ? (
				<td className="record-expand">&nbsp;</td>
			) : null }
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
				<div className="flex gap-1 items-end mb-1">
					<Skeleton className="h-[15px] w-[11px]" />
					<Skeleton className="h-[5px] w-[11px]" />
					<Skeleton className="h-[15px] w-[11px]" />
					<Skeleton className="h-[5px] w-[11px]" />
					<Skeleton className="h-[15px] w-[11px]" />
					<Skeleton className="h-[10px] w-[11px]" />
					<Skeleton className="h-[5px] w-[11px]" />
				</div>
				<div className="flex flex-col gap-1 ml-auto">
					<Skeleton className="h-1.5 w-[58px]" />
					<Skeleton className="h-1.5 w-[48px]" />
				</div>
			</td>
			<td className="record-lift">&nbsp;</td>
			<td className="record-meta">
				<div className="flex gap-3 items-center">
					<Skeleton className="h-[30px] w-[30px] rounded" />
					<div className="flex flex-col gap-1">
						<Skeleton className="h-1.5 w-[110px]" />
						<Skeleton className="h-1.5 w-[70px]" />
					</div>
				</div>
			</td>
		</tr>
	);
};

export default ListItemPlaceholder;
