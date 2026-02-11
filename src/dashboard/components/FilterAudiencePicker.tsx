import {
	withSelect,
} from '@wordpress/data';
import { __ } from '@wordpress/i18n';

import { Audience, Pagination, Post } from '../../audiences/types';
import { DynamicEstimate } from '../../audiences/ui/components/estimate';

import { Button } from '@/components/ui/button';

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
		<div className="mx-3 my-4">
			<ul className="divide-y divide-border">
				{ /* All Traffic option - always at top */ }
				<li className="relative flex items-center justify-between gap-x-6 py-4">
					<div className="flex min-w-0 gap-x-4">
						<div className="min-w-0 flex-auto">
							<p className="text-sm font-semibold leading-6 text-foreground">
								{ __( 'All Traffic', 'altis' ) }
							</p>
							<p className="mt-1 text-xs leading-5 text-muted-foreground">
								{ __( 'Show analytics for all visitors without filtering', 'altis' ) }
							</p>
						</div>
					</div>
					<div className="flex shrink-0 items-center gap-x-4">
						{ selectedMode === 'all' ? (
							<span className="text-sm text-muted-foreground">
								{ __( 'Selected', 'altis' ) }
							</span>
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
									<p className="text-sm font-semibold leading-6 text-foreground">
										{ post.title.rendered }
									</p>
								</div>
							</div>
							<div className="flex shrink-0 items-center gap-x-4">
								<DynamicEstimate
									audience={ post.audience }
									showPie={ false }
									sparkline
								/>
								{ isSelected ? (
									<span className="text-sm text-muted-foreground">
										{ __( 'Selected', 'altis' ) }
									</span>
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
							<p className="text-sm font-semibold leading-6 text-foreground">
								{ __( 'Custom Filter', 'altis' ) }
							</p>
							<p className="mt-1 text-xs leading-5 text-muted-foreground">
								{ __( 'Create your own filter rules for this session', 'altis' ) }
							</p>
						</div>
					</div>
					<div className="flex shrink-0 items-center gap-x-4">
						{ selectedMode === 'custom' ? (
							<span className="text-sm text-muted-foreground">
								{ __( 'Selected', 'altis' ) }
							</span>
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
