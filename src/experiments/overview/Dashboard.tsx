import { FlaskConical } from 'lucide-react';
import React, { useState, useCallback, useEffect, useMemo } from 'react';

import { useSelect, useDispatch } from '@wordpress/data';
import { __, sprintf } from '@wordpress/i18n';

import { ExperimentRowSkeleton } from './components/ExperimentRowSkeleton';
import ExperimentsList from './components/ExperimentsList';
import { store, QueryArgs } from './data/store';

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
			args.type = typeFilter;
		}
		if ( search ) {
			args.search = search;
		}
		return args;
	}, [ statusFilter, typeFilter, search, page ] );

	const { fetchExperiments } = useDispatch( store );

	useEffect( () => {
		fetchExperiments( queryArgs );
	}, [ queryArgs, fetchExperiments ] );

	const { experiments, pagination, isLoading, error } = useSelect(
		select => {
			const storeSelect = select( store );
			return {
				experiments: storeSelect.getExperiments(),
				pagination: storeSelect.getPagination(),
				isLoading: storeSelect.getIsLoading(),
				error: storeSelect.getError(),
			};
		},
		[]
	);

	const dataState: DataState = useMemo( () => {
		if ( isLoading ) {
			return 'loading';
		}
		if ( error ) {
			return 'error';
		}
		if ( experiments.length === 0 ) {
			return 'empty';
		}
		return 'loaded';
	}, [ isLoading, error, experiments ] );

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

	const emptyTitle = useMemo( () => {
		if ( search ) {
			return __( 'No matching experiments', 'altis' );
		}

		const typeLabels: Record<TypeFilter, string> = {
			all: '',
			block: __( 'A/B block', 'altis' ),
			personalization: __( 'personalization', 'altis' ),
			post_tests: __( 'post test', 'altis' ),
		};
		const typeLabel = typeLabels[ typeFilter ];

		const statusLabels: Record<StatusFilter, string> = {
			all: '',
			active: __( 'active', 'altis' ),
			completed: __( 'completed', 'altis' ),
			draft: __( 'draft', 'altis' ),
		};
		const statusLabel = statusLabels[ statusFilter ];

		if ( statusLabel && typeLabel ) {
			/* translators: 1: status (e.g. "active"), 2: type (e.g. "A/B block") */
			return sprintf( __( 'No %1$s %2$s experiments yet', 'altis' ), statusLabel, typeLabel );
		}
		if ( statusLabel ) {
			/* translators: %s: status (e.g. "active") */
			return sprintf( __( 'No %s experiments yet', 'altis' ), statusLabel );
		}
		if ( typeLabel ) {
			/* translators: %s: type (e.g. "A/B block") */
			return sprintf( __( 'No %s experiments yet', 'altis' ), typeLabel );
		}
		return __( 'No experiments yet', 'altis' );
	}, [ statusFilter, typeFilter, search ] );

	const emptyDescription = useMemo( () => {
		if ( search ) {
			return __( 'Try a different search term or adjust your filters.', 'altis' );
		}
		return __( 'Create A/B tests and personalization blocks in the editor to see them here.', 'altis' );
	}, [ search ] );

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
						description={ emptyDescription }
						icon={ <FlaskConical className="h-10 w-10" /> }
						title={ emptyTitle }
					/>
				}
				skeleton={ <ExperimentRowSkeleton /> }
				state={ dataState }
			>
				<ExperimentsList
					experiments={ experiments }
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
