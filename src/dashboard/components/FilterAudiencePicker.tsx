import { Button } from '@wordpress/components';
import {
	withSelect,
	withDispatch,
} from '@wordpress/data';
import { __ } from '@wordpress/i18n';

import { Audience, Pagination, Post } from '../../audiences/types';
import { DynamicEstimate } from '../../audiences/ui/components/estimate';

import FilterSummary from './FilterSummary';

interface OwnProps {
	onSelect( audience: Audience, id: number ): void,
}

interface Props {
	canCreate: boolean,
	loading: boolean,
	pagination: Pagination,
	posts: Post[],
	onGetPosts: any,
}

function FilterAudiencePicker( props: Props & OwnProps ) {
	return (
		<div className="mx-3 my-4 border-b border-b-gray-300">
			<div>
				<h2 className="text-lg font-bold">Select an existing audience</h2>
				<ul className="my-2 divide-y divide-gray-100">
					{ props.posts.map( post => (
						<li
							key={ post.id } className="relative flex items-center justify-between gap-x-6 py-5 overflow-hidden"
						>
							<div className="flex min-w-0 gap-x-4">
								{ /* <img alt="" src={person.imageUrl} className="h-12 w-12 flex-none rounded-full bg-gray-50" /> */ }
								<div className="min-w-0 flex-auto">
									<p className="text-sm font-semibold leading-6 text-gray-900">
										{ post.title.rendered }
									</p>
									<p className="mt-1 text-xs leading-5 text-gray-500">
										<FilterSummary
											filter={ {
												audience: post.audience,
											} }
										/>
									</p>
								</div>
							</div>
							<div className="flex shrink-0 items-center">
							</div>
							<div className="flex shrink-0 items-center gap-x-4">
								<DynamicEstimate
									audience={ post.audience }
									showPie={ false }
									sparkline
								/>
								<Button
									className="px-2.5"
									isSecondary
									type="button"
									onClick={ () => props.onSelect( post.audience, post.id ) }
								>
									{ __( 'Select', 'altis' ) }
								</Button>
							</div>
						</li>
					) ) }
				</ul>
			</div>
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
