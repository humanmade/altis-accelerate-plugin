import React, { useState } from 'react';

import { useDispatch, useSelect } from '@wordpress/data';
import { decodeEntities } from '@wordpress/html-entities';
import { __, sprintf } from '@wordpress/i18n';

import { Blueprint, BlueprintVariant } from '../types';

import { Select as AudiencePicker } from '@/audiences/ui';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Body, Caption, SectionTitle } from '@/components/ui/typography';

interface EditorProps {
	blueprint: Blueprint;
	onClose: () => void;
}

const emptyVariant = (): BlueprintVariant => ( {
	title: '',
	audience: 0,
	fallback: false,
	percentage: null,
} );

/**
 * Audience picker for a variant row.
 *
 * Uses the audience selector's `button` render-prop so it opens the audience
 * manager as a popup (the default inline control renders poorly here), and
 * shows the chosen audience's name on the trigger.
 */
function VariantAudiencePicker( { audience, onSelect }: { audience: number, onSelect: ( id: number ) => void } ) {
	const audiencePost = useSelect(
		( select: any ) => ( audience ? select( 'audience' ).getPost( audience ) : null ),
		[ audience ]
	);
	const title = audiencePost?.title?.rendered || audiencePost?.title?.raw || '';

	return (
		<AudiencePicker
			audience={ audience || null }
			button={ ( { onOpen }: { onOpen: () => void } ) => (
				<Button variant="outline" onClick={ onOpen }>
					{ audience && title
						? decodeEntities( title )
						: ( audience ? __( 'Change audience', 'altis' ) : __( 'Select audience', 'altis' ) ) }
				</Button>
			) }
			onSelect={ ( id: number ) => onSelect( id ) }
		/>
	);
}

/**
 * Create / edit a single blueprint.
 *
 * Inline (master-detail) rather than a modal, so the audience picker — which
 * opens its own full-screen modal — never has to nest inside another modal.
 */
export default function Editor( { blueprint, onClose }: EditorProps ) {
	const [ draft, setDraft ] = useState<Blueprint>( () => {
		// Guarantee a fallback variant at index 0.
		const variants = blueprint.variants && blueprint.variants.length > 0
			? blueprint.variants
			: [ {
				title: __( 'Default', 'altis' ),
				audience: 0,
				fallback: true,
				percentage: null,
			} ];
		return {
			...blueprint,
			variants,
		};
	} );

	const { createBlueprint, updateBlueprint } = useDispatch( 'blueprints' );
	const isUpdating = useSelect( ( s: any ) => s( 'blueprints' ).getIsUpdating(), [] );
	const [ saveError, setSaveError ] = useState<string | null>( null );

	const isNew = ! draft.id;

	const setVariant = ( index: number, changes: Partial<BlueprintVariant> ) => {
		setDraft( current => ( {
			...current,
			variants: current.variants.map( ( v, i ) => ( i === index ? {
				...v,
				...changes,
			} : v ) ),
		} ) );
	};

	const addVariant = () => {
		setDraft( current => ( {
			...current,
			variants: [ ...current.variants, emptyVariant() ],
		} ) );
	};

	const removeVariant = ( index: number ) => {
		setDraft( current => ( {
			...current,
			// Never remove the fallback at index 0.
			variants: current.variants.filter( ( _, i ) => i !== index || i === 0 ),
		} ) );
	};

	const canSave = draft.title.trim() !== ''
		&& draft.variants.slice( 1 ).every( v => v.audience > 0 )
		&& draft.variants.length >= 2
		&& ! isUpdating;

	const save = async () => {
		if ( ! canSave ) {
			return;
		}
		setSaveError( null );
		try {
			if ( isNew ) {
				await createBlueprint( draft );
			} else {
				await updateBlueprint( draft );
			}
			onClose();
		} catch ( error: any ) {
			// Keep the editor open with the draft intact — server-side
			// validation errors (missing audience etc.) carry a message.
			setSaveError( error?.message || __( 'Could not save the blueprint.', 'altis' ) );
		}
	};

	return (
		<div className="max-w-3xl">
			<div className="flex items-center justify-between mb-6">
				<SectionTitle>
					{ isNew ? __( 'New blueprint', 'altis' ) : __( 'Edit blueprint', 'altis' ) }
				</SectionTitle>
				<Button variant="ghost" onClick={ onClose }>{ __( 'Back', 'altis' ) }</Button>
			</div>

			<div className="space-y-2 mb-6">
				<Label htmlFor="blueprint-title">{ __( 'Name', 'altis' ) }</Label>
				<Input
					id="blueprint-title"
					placeholder={ __( 'e.g. Regional content (EU / US / APAC)', 'altis' ) }
					value={ draft.title }
					onChange={ e => setDraft( {
						...draft,
						title: e.target.value,
					} ) }
				/>
				<Caption>
					{ __( 'Shown in the block "…" menu when applying this blueprint to selected blocks.', 'altis' ) }
				</Caption>
			</div>

			<div className="flex items-center gap-3 mb-8">
				<Switch
					checked={ draft.status === 'published' }
					id="blueprint-published"
					onCheckedChange={ ( checked: boolean ) => setDraft( {
						...draft,
						status: checked ? 'published' : 'draft',
					} ) }
				/>
				<Label htmlFor="blueprint-published">{ __( 'Published (available in the editor)', 'altis' ) }</Label>
			</div>

			<SectionTitle className="mb-1">{ __( 'Variants', 'altis' ) }</SectionTitle>
			<Caption className="block mb-4">
				{ __( 'The default is shown to everyone who does not match a variant audience. Each variant targets one audience.', 'altis' ) }
			</Caption>

			<div className="space-y-3">
				{ draft.variants.map( ( variant, index ) => (
					<Card key={ index }>
						<CardContent className="flex items-center gap-4 py-4">
							<div className="flex-1">
								<Input
									aria-label={ __( 'Variant label', 'altis' ) }
									placeholder={ index === 0 ? __( 'Default', 'altis' ) : __( 'Variant label', 'altis' ) }
									value={ variant.title }
									onChange={ e => setVariant( index, { title: e.target.value } ) }
								/>
							</div>
							<div className="flex-1">
								{ index === 0 ? (
									<Body className="text-muted-foreground">
										{ __( 'Everyone else (default)', 'altis' ) }
									</Body>
								) : (
									<VariantAudiencePicker
										audience={ variant.audience }
										onSelect={ ( id: number ) => setVariant( index, { audience: id } ) }
									/>
								) }
							</div>
							{ index !== 0 && (
								<Button variant="ghost" onClick={ () => removeVariant( index ) }>
									{ __( 'Remove', 'altis' ) }
								</Button>
							) }
						</CardContent>
					</Card>
				) ) }
			</div>

			<div className="mt-4">
				<Button variant="secondary" onClick={ addVariant }>
					{ __( '+ Add variant', 'altis' ) }
				</Button>
			</div>

			<div className="flex items-center gap-3 mt-8 border-t pt-6">
				<Button disabled={ ! canSave } onClick={ save }>
					{ isUpdating
						? __( 'Saving…', 'altis' )
						: ( isNew ? __( 'Create blueprint', 'altis' ) : __( 'Save changes', 'altis' ) ) }
				</Button>
				<Button variant="ghost" onClick={ onClose }>{ __( 'Cancel', 'altis' ) }</Button>
				{ saveError && (
					<Caption className="text-destructive">{ saveError }</Caption>
				) }
				{ draft.variants.slice( 1 ).some( v => v.audience === 0 ) && (
					<Caption className="text-destructive">
						{ sprintf(
							/* translators: %d: number of variants missing an audience. */
							__( '%d variant(s) need an audience.', 'altis' ),
							draft.variants.slice( 1 ).filter( v => v.audience === 0 ).length
						) }
					</Caption>
				) }
			</div>
		</div>
	);
}
