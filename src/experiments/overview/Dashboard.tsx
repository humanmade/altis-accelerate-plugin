import { FlaskConical } from 'lucide-react';
import React, { useState, useCallback, useMemo } from 'react';

import { useSelect, useDispatch } from '@wordpress/data';
import { __, sprintf } from '@wordpress/i18n';

import { ExperimentRowSkeleton } from './components/ExperimentRowSkeleton';
import ExperimentsList from './components/ExperimentsList';
import { store, Experiment, QueryArgs } from './data/store';

import { VerticalDivider } from '@/accelerate/components/shared/HeaderRow';
import { DataContainer } from '@/components/DataContainer';
import { EmptyState } from '@/components/EmptyState';
import { SearchField } from '@/components/SearchField';
import { AnimatedTabs } from '@/components/ui/animated-tabs';
import { Button } from '@/components/ui/button';
import { usePersistentState } from '@/data/hooks';
import type { DataState } from '@/types/component-states';

const STATUS_OPTIONS = [
	{
		value: 'all',
		label: __( 'All', 'altis' ),
	},
	{
		value: 'active',
		label: __( 'Active', 'altis' ),
	},
	{
		value: 'completed',
		label: __( 'Completed', 'altis' ),
	},
	{
		value: 'draft',
		label: __( 'Draft', 'altis' ),
	},
] as const;

const TYPE_OPTIONS = [
	{
		value: 'all',
		label: __( 'All', 'altis' ),
	},
	{
		value: 'block',
		label: __( 'A/B Blocks', 'altis' ),
	},
	{
		value: 'personalization',
		label: __( 'Personalization', 'altis' ),
	},
	{
		value: 'post_tests',
		label: __( 'Post Tests', 'altis' ),
	},
] as const;

type StatusFilter = typeof STATUS_OPTIONS[number]['value'];
type TypeFilter = typeof TYPE_OPTIONS[number]['value'];

export default function Dashboard() {
	const [ statusFilter, setStatusFilter ] = usePersistentState<StatusFilter>( 'experiments-status', 'all' );
	const [ typeFilter, setTypeFilter ] = usePersistentState<TypeFilter>( 'experiments-type', 'all' );
	const [ search, setSearch ] = useState( '' );
	const [ page, setPage ] = useState( 1 );

	const queryArgs: QueryArgs = useMemo( () => {
		const args: QueryArgs = {
			page,
			per_page: 20,
		};
		if ( statusFilter !== 'all' ) {
			args.status = statusFilter;
		}
		if ( typeFilter !== 'all' ) {
			if ( typeFilter === 'post_tests' ) {
				// Post tests include titles and featured_images - we'll filter client-side.
			} else {
				args.type = typeFilter;
			}
		}
		if ( search ) {
			args.search = search;
		}
		return args;
	}, [ statusFilter, typeFilter, search, page ] );

	const { experiments, pagination, isLoading } = useSelect(
		select => {
			const storeSelect = select( 'accelerate/experiments' );
			return {
				experiments: storeSelect.getExperiments( queryArgs ),
				pagination: storeSelect.getPagination(),
				isLoading: storeSelect.getIsLoading(),
			};
		},
		[ queryArgs ]
	);

	// Client-side filter for "post_tests" type which includes both titles and featured_images.
	const filteredExperiments = useMemo( () => {
		if ( typeFilter === 'post_tests' ) {
			return experiments.filter( ( exp: Experiment ) =>
				exp.type === 'titles' || exp.type === 'featured_images'
			);
		}
		return experiments;
	}, [ experiments, typeFilter ] );

	const dataState: DataState = useMemo( () => {
		if ( isLoading ) {
			return 'loading';
		}
		if ( filteredExperiments.length === 0 ) {
			return 'empty';
		}
		return 'loaded';
	}, [ isLoading, filteredExperiments ] );

	const handleStatusChange = useCallback( ( value: StatusFilter ) => {
		setStatusFilter( value );
		setPage( 1 );
	}, [ setStatusFilter ] );

	const handleTypeChange = useCallback( ( value: TypeFilter ) => {
		setTypeFilter( value );
		setPage( 1 );
	}, [ setTypeFilter ] );

	const handleSearch = useCallback( ( value: string ) => {
		setSearch( value );
		setPage( 1 );
	}, [] );

	return (
		<div className="tailwind">
			<div
				className="flex font-sans gap-4 items-center py-3"
				style={ { padding: '0.75rem 5%' } }
			>
				<AnimatedTabs
					options={ STATUS_OPTIONS as any }
					value={ statusFilter }
					onValueChange={ handleStatusChange }
				/>
				<VerticalDivider />
				<AnimatedTabs
					options={ TYPE_OPTIONS as any }
					value={ typeFilter }
					onValueChange={ handleTypeChange }
				/>
				<div className="flex-1" />
				<SearchField
					placeholder={ __( 'Search experiments...', 'altis' ) }
					onChange={ handleSearch }
				/>
			</div>
			<DataContainer
				empty={
					<EmptyState
						action={
							<Button
								variant="outline"
								onClick={ () => window.open( 'https://developer.acceleratewp.com/experiments/', '_blank' ) }
							>
								{ __( 'Learn more', 'altis' ) }
							</Button>
						}
						description={ __( 'Create A/B tests and personalization blocks in the editor to see them here.', 'altis' ) }
						icon={ <FlaskConical className="h-10 w-10" /> }
						title={ __( 'No experiments yet', 'altis' ) }
					/>
				}
				skeleton={ <ExperimentRowSkeleton /> }
				state={ dataState }
			>
				<ExperimentsList
					experiments={ filteredExperiments }
					footer={ pagination.pages > 1 ? (
						<div className="flex justify-center gap-2 py-6">
							<Button
								disabled={ page <= 1 }
								variant="outline"
								onClick={ () => setPage( Math.max( 1, page - 1 ) ) }
							>
								{ __( 'Previous', 'altis' ) }
							</Button>
							<span className="flex items-center !text-sm text-muted-foreground px-3">
								{ /* translators: %1$d: current page, %2$d: total pages */ }
								{ sprintf( __( 'Page %1$d of %2$d', 'altis' ), page, pagination.pages ) }
							</span>
							<Button
								disabled={ page >= pagination.pages }
								variant="outline"
								onClick={ () => setPage( Math.min( pagination.pages, page + 1 ) ) }
							>
								{ __( 'Next', 'altis' ) }
							</Button>
						</div>
					) : undefined }
				/>
			</DataContainer>
		</div>
	);
}
