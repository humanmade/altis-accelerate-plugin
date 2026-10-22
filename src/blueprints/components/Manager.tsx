import React, { useState } from 'react';

import { useDispatch, useSelect } from '@wordpress/data';
import { __ } from '@wordpress/i18n';

import '../data';
import { Blueprint } from '../types';

import Editor from './Editor';

import { DataContainer } from '@/components/DataContainer';
import { EmptyState } from '@/components/EmptyState';
import { EmptyStatePreview } from '@/components/EmptyStatePreview';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Body, Caption, SectionTitle } from '@/components/ui/typography';
import type { DataState } from '@/types/component-states';

const blankBlueprint = (): Blueprint => ( {
	title: '',
	type: 'personalization',
	status: 'draft',
	goal: 'engagement',
	variants: [],
} );

function BlueprintRow( { blueprint, onEdit }: { blueprint: Blueprint, onEdit: () => void } ) {
	const { deleteBlueprint } = useDispatch( 'blueprints' );
	const variantCount = Math.max( 0, blueprint.variants.length - 1 );

	const onDelete = async () => {
		// eslint-disable-next-line no-alert
		if ( ! window.confirm( __( 'Delete this blueprint? This cannot be undone.', 'altis' ) ) ) {
			return;
		}
		try {
			await deleteBlueprint( blueprint.id as number );
		} catch ( error: any ) {
			// eslint-disable-next-line no-alert
			window.alert( error?.message || __( 'Could not delete the blueprint.', 'altis' ) );
		}
	};

	return (
		<Card>
			<CardContent className="flex items-center gap-4 py-4">
				<div className="flex-1">
					<Body className="font-semibold">{ blueprint.title || __( '(untitled)', 'altis' ) }</Body>
					<Caption>
						{ blueprint.status === 'published' ? __( 'Published', 'altis' ) : __( 'Draft', 'altis' ) }
						{ ' · ' }
						{ variantCount === 1
							? __( '1 variant', 'altis' )
							: `${ variantCount } ${ __( 'variants', 'altis' ) }` }
					</Caption>
				</div>
				<Button variant="secondary" onClick={ onEdit }>{ __( 'Edit', 'altis' ) }</Button>
				<Button variant="ghost" onClick={ onDelete }>{ __( 'Delete', 'altis' ) }</Button>
			</CardContent>
		</Card>
	);
}

/**
 * Blueprints CRUD manager. Rendered as a section of the Accelerate settings app.
 */
export default function Manager() {
	const [ editing, setEditing ] = useState<Blueprint | null>( null );

	const { blueprints, isLoading, loaded, error } = useSelect( ( select: any ) => ( {
		blueprints: select( 'blueprints' ).getBlueprints(),
		isLoading: select( 'blueprints' ).getIsLoading(),
		loaded: select( 'blueprints' ).isLoaded(),
		error: select( 'blueprints' ).getError(),
	} ), [] );
	const { invalidateResolution } = useDispatch( 'blueprints' );

	if ( editing ) {
		return <Editor blueprint={ editing } onClose={ () => setEditing( null ) } />;
	}

	const state: DataState = ! loaded && isLoading
		? 'loading'
		: ( ! loaded && error
			? 'error'
			: ( blueprints.length === 0 ? 'empty' : 'loaded' ) );

	return (
		<div>
			<div className="flex items-start justify-between gap-4 mb-6">
				<div className="space-y-1">
					<SectionTitle>{ __( 'Blueprints', 'altis' ) }</SectionTitle>
					<Caption>
						{ __( 'Reusable presets of variants and audiences you can apply to any block from the editor.', 'altis' ) }
					</Caption>
				</div>
				{ state !== 'empty' && (
					<Button variant="outline" onClick={ () => setEditing( blankBlueprint() ) }>
						{ __( 'New blueprint', 'altis' ) }
					</Button>
				) }
			</div>

			<DataContainer
				empty={
					<EmptyStatePreview preview={ <div className="space-y-3">{ [ 0, 1, 2, 3 ].map( i => <Skeleton key={ i } className="h-16 w-full" /> ) }</div> }>
						<EmptyState
							action={
								<Button onClick={ () => setEditing( blankBlueprint() ) }>
									{ __( 'New blueprint', 'altis' ) }
								</Button>
							}
							description={ __( 'Create a reusable preset of variants and audiences, then apply it to any block selection from the editor "…" menu.', 'altis' ) }
							title={ __( 'No blueprints yet', 'altis' ) }
						/>
					</EmptyStatePreview>
				}
				errorMessage={ error || undefined }
				skeleton={ <div className="space-y-3">{ [ 0, 1, 2 ].map( i => <Skeleton key={ i } className="h-16 w-full" /> ) }</div> }
				state={ state }
				onRetry={ () => invalidateResolution( 'getBlueprints', [] ) }
			>
				<div className="space-y-3">
					{ blueprints.map( ( blueprint: Blueprint ) => (
						<BlueprintRow
							key={ blueprint.id }
							blueprint={ blueprint }
							onEdit={ () => setEditing( blueprint ) }
						/>
					) ) }
				</div>
			</DataContainer>
		</div>
	);
}
