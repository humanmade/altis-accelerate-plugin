import { Check } from 'lucide-react';

import {
	useSelect,
	withSelect,
} from '@wordpress/data';
import { __, sprintf, _n } from '@wordpress/i18n';

import { store as audiencesStore } from '../../audiences/data';
import { Audience, Pagination, Post } from '../../audiences/types';

import { Button } from '@/components/ui/button';

/**
 * Confident selected-state chip. Occupies the same footprint zone as the
 * Select button so the right column doesn't jump when selection changes.
 */
function SelectedChip() {
	return (
		<span className="inline-flex items-center gap-1.5 rounded-md bg-brand/10 px-3 py-2 text-sm font-medium text-brand">
			<Check className="size-4" />
			{ __( 'Selected', 'altis' ) }
		</span>
	);
}

/**
 * Compact horizontal estimate readout for the audience picker rows.
 * The full DynamicEstimate is designed for the edit screen (220×60
 * sparkline, vertical stack) and breaks the row layout here.
 */
function InlineEstimate( { audience }: { audience: Audience } ) {
	const estimate = useSelect( select => select( audiencesStore ).getEstimate( audience ), [ audience ] );
	if ( ! estimate || estimate.isLoading ) {
		return (
			<span className="text-xs text-muted-foreground">
				{ __( 'Estimating…', 'altis' ) }
			</span>
		);
	}
	const percent = estimate.total ? Math.round( ( estimate.count / estimate.total ) * 100 ) : 0;
	const count = estimate.count ?? 0;
	return (
		<div className="flex items-center gap-3 text-xs text-muted-foreground tabular-nums">
			<span className="inline-flex items-baseline gap-1 font-medium text-foreground">
				<span>{ percent }</span>
				<span className="text-[10px] text-muted-foreground">%</span>
			</span>
			<span className="text-muted-foreground">
				{ sprintf(
					/* translators: %d: count of unique visitors */
					_n( '%d unique / 7d', '%d uniques / 7d', count, 'altis' ),
					count
				) }
			</span>
		</div>
	);
}

// Selection mode types
export type SelectionMode = 'all' | 'audience' | 'custom';

interface OwnProps {
	selectedMode: SelectionMode,
	selectedAudienceId?: number,
	onSelectAllTraffic(): void,
	onSelectAudience( audience: Audience, id: number, title: string ): void,
	onSelectCustomFilter(): void,
}

interface Props {
	canCreate: boolean,
	loading: boolean,
	pagination: Pagination,
	posts: Post[],
	onGetPosts: any,
}

function FilterAudiencePicker( props: Props & OwnProps ) {
	const {
		selectedMode,
		selectedAudienceId,
		onSelectAllTraffic,
		onSelectAudience,
		onSelectCustomFilter,
		posts,
	} = props;

	return (
		<div className="mx-3 pb-2">
			<ul className="divide-y divide-border">
				{ /* All Traffic option - always at top */ }
				<li className="relative flex items-center justify-between gap-x-6 py-4">
					<div className="flex min-w-0 gap-x-4">
						<div className="min-w-0 flex-auto">
							<div className="text-sm font-semibold leading-6 text-foreground">
								{ __( 'All Traffic', 'altis' ) }
							</div>
							<div className="mt-1 text-xs leading-5 text-muted-foreground">
								{ __( 'Show analytics for all visitors without filtering', 'altis' ) }
							</div>
						</div>
					</div>
					<div className="flex shrink-0 items-center gap-4">
						<div className="w-44 flex justify-end" />
						{ selectedMode === 'all' ? (
							<SelectedChip />
						) : (
							<Button
								type="button"
								variant="outline"
								onClick={ onSelectAllTraffic }
							>
								{ __( 'Select', 'altis' ) }
							</Button>
						) }
					</div>
				</li>

				{ /* Saved audiences */ }
				{ posts.map( post => {
					const isSelected = selectedMode === 'audience' && selectedAudienceId === post.id;
					return (
						<li
							key={ post.id }
							className="relative flex items-center justify-between gap-x-6 py-4"
						>
							<div className="flex min-w-0 gap-x-4">
								<div className="min-w-0 flex-auto">
									<div className="text-sm font-semibold leading-6 text-foreground">
										{ post.title.rendered }
									</div>
								</div>
							</div>
							<div className="flex shrink-0 items-center gap-4">
								<div className="w-44 flex justify-end">
									<InlineEstimate audience={ post.audience } />
								</div>
								{ isSelected ? (
									<SelectedChip />
								) : (
									<Button
										type="button"
										variant="outline"
										onClick={ () => onSelectAudience( post.audience, post.id, post.title.rendered ) }
									>
										{ __( 'Select', 'altis' ) }
									</Button>
								) }
							</div>
						</li>
					);
				} ) }

				{ /* Custom filter option - always at bottom */ }
				<li className="relative flex items-center justify-between gap-x-6 py-4">
					<div className="flex min-w-0 gap-x-4">
						<div className="min-w-0 flex-auto">
							<div className="text-sm font-semibold leading-6 text-foreground">
								{ __( 'Custom Filter', 'altis' ) }
							</div>
							<div className="mt-1 text-xs leading-5 text-muted-foreground">
								{ __( 'Create your own filter rules for this session', 'altis' ) }
							</div>
						</div>
					</div>
					<div className="flex shrink-0 items-center gap-4">
						<div className="w-44 flex justify-end" />
						{ selectedMode === 'custom' ? (
							<SelectedChip />
						) : (
							<Button
								type="button"
								variant="outline"
								onClick={ onSelectCustomFilter }
							>
								{ __( 'Select', 'altis' ) }
							</Button>
						) }
					</div>
				</li>
			</ul>
		</div>
	);
}

const applyWithSelect = withSelect( ( select : any ) => {
	const {
		getPosts,
		getIsLoading,
		getPagination,
	} = select( 'audience' );
	const canCreate = select( 'core' ).canUser( 'create', 'audiences' );
	const loading = getIsLoading();
	const pagination = getPagination();
	const queryArgs = {
		context: canCreate ? 'edit' : 'view',
		status: canCreate ? 'publish,draft' : 'publish',
	};
	const posts = getPosts( queryArgs );

	return {
		canCreate,
		loading,
		pagination,
		posts,
		onGetPosts: getPosts,
	};
} ) as unknown as ( component: React.ComponentType<Props & OwnProps> ) => React.ComponentType<OwnProps>;

export default applyWithSelect( FilterAudiencePicker );
