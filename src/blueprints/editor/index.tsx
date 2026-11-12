/**
 * Blueprints editor integration.
 *
 * Adds an "Apply blueprint" group to the block "…" options menu. Applying a
 * blueprint is done entirely client-side: it builds the personalization variant
 * blocks in memory from the current selection, creates the synced-pattern
 * (wp_block) via the normal entity save (which fires the existing
 * `save_variants()` hook server-side), and replaces the selection with a
 * `core/block` reference. There is no new save-side backend.
 */
import { store as BlockEditorStore, BlockSettingsMenuControls } from '@wordpress/block-editor';
import { BlockInstance, cloneBlock, createBlock, serialize } from '@wordpress/blocks';
import { MenuItem } from '@wordpress/components';
import { store as CoreDataStore } from '@wordpress/core-data';
import { useDispatch, useSelect, select as dataSelect } from '@wordpress/data';
import { __, sprintf } from '@wordpress/i18n';
import { registerPlugin } from '@wordpress/plugins';

import '../data';
import { Blueprint } from '../types';

import { AccelerateBlockIcon } from '@/global-blocks/utils/icons';

/**
 * Does the block tree contain anything already wired into an experiment
 * (a core/block reference or a variant block), at any depth?
 */
function containsWiredBlock( blocks: BlockInstance[] ): boolean {
	return blocks.some(
		block => block.name === 'core/block'
			|| block.name === 'altis/variant'
			|| containsWiredBlock( block.innerBlocks || [] )
	);
}

/**
 * Can a blueprint be applied to the given selection?
 *
 * Conservative guard: not inside a synced pattern (the in-block Header owns that
 * flow), at least one block selected, and nothing already wired into an
 * experiment (no core/block references or variant blocks anywhere in the
 * selection, including nested inside containers like Group).
 */
function isEligible( clientIds: string[] ): boolean {
	if ( ! clientIds || clientIds.length === 0 ) {
		return false;
	}

	const postType = dataSelect( 'core/editor' )?.getCurrentPostType?.();
	if ( postType === 'wp_block' ) {
		return false;
	}

	const blocks: BlockInstance[] = dataSelect( BlockEditorStore ).getBlocksByClientId( clientIds );
	return blocks.length > 0
		&& blocks.every( Boolean )
		&& ! containsWiredBlock( blocks );
}

/**
 * Build the variant blocks for a blueprint from the selected blocks.
 *
 * Index 0 is always the fallback (the original content, no audience). Each
 * audience-targeted blueprint variant clones the selection as its starting
 * content — the editor surfaces a "matches default" hint until it is edited.
 */
function buildVariantBlocks( blueprint: Blueprint, selected: BlockInstance[] ): BlockInstance[] {
	const cloneSelection = () => selected.map( block => cloneBlock( block ) );

	const fallbackEntry = blueprint.variants.find( v => v.fallback );
	const audienceEntries = blueprint.variants.filter( v => ! v.fallback );

	const variants: BlockInstance[] = [];

	variants.push(
		createBlock(
			'altis/variant',
			{
				fallback: true,
				title: fallbackEntry?.title || __( 'Default', 'altis' ),
			},
			cloneSelection()
		)
	);

	audienceEntries.forEach( entry => {
		variants.push(
			createBlock(
				'altis/variant',
				{
					fallback: false,
					audience: entry.audience,
					title: entry.title,
					...( entry.percentage !== null ? { percentage: entry.percentage } : {} ),
				},
				cloneSelection()
			)
		);
	} );

	return variants;
}

/**
 * The "…" menu fill.
 */
function BlueprintsMenu() {
	// Only published personalization blueprints: applying builds
	// audience-targeted variant blocks, which is meaningless for other types.
	const blueprints: Blueprint[] = useSelect(
		( select: any ) => select( 'blueprints' ).getBlueprints().filter(
			( bp: Blueprint ) => bp.status === 'published' && bp.type === 'personalization'
		),
		[]
	);

	const { saveEntityRecord, deleteEntityRecord } = useDispatch( CoreDataStore );
	const { replaceBlocks, selectBlock } = useDispatch( BlockEditorStore );
	const { createSuccessNotice, createErrorNotice } = useDispatch( 'core/notices' );

	if ( blueprints.length === 0 ) {
		return null;
	}

	const apply = async ( blueprint: Blueprint, clientIds: string[] ) => {
		const selected: BlockInstance[] = dataSelect( BlockEditorStore ).getBlocksByClientId( clientIds );
		if ( selected.length === 0 ) {
			return;
		}

		let wpBlock: any = null;
		try {
			const variants = buildVariantBlocks( blueprint, selected );

			// Create the synced pattern. Setting blockType + content in one save
			// makes the server `save_variants()` hook wire up the personalization
			// experiment — no new save-side code.
			wpBlock = await saveEntityRecord( 'postType', 'wp_block', {
				title: blueprint.title || __( 'Personalized content', 'altis' ),
				status: 'publish',
				content: serialize( variants ),
				blockType: 'personalization',
				goal: blueprint.goal || 'engagement',
			} );

			if ( ! wpBlock || ! wpBlock.id ) {
				throw new Error( 'Failed to create synced pattern.' );
			}

			const ref = createBlock( 'core/block', { ref: wpBlock.id } );
			await replaceBlocks( clientIds, ref );

			// replaceBlocks silently no-ops when the client IDs have gone stale
			// (e.g. the selection was deleted while the pattern was saving).
			if ( ! dataSelect( BlockEditorStore ).getBlock( ref.clientId ) ) {
				throw new Error( 'Selection no longer exists.' );
			}

			createSuccessNotice(
				sprintf(
					/* translators: %s: blueprint name. */
					__( 'Applied blueprint "%s".', 'altis' ),
					blueprint.title
				),
				{ type: 'snackbar' }
			);

			// Jump straight into editing the synced pattern (the focused,
			// "Back"-able pattern editor) so the user can immediately
			// differentiate each variant's content. Mirrors core/block's
			// "Edit original". Falls back to selecting the reference block if
			// the editor doesn't expose entity-record navigation.
			const navigate = dataSelect( BlockEditorStore ).getSettings()?.onNavigateToEntityRecord;
			if ( navigate ) {
				navigate( {
					postId: wpBlock.id,
					postType: 'wp_block',
				} );
			} else {
				selectBlock( ref.clientId );
			}
		} catch ( error ) {
			// The pattern was published before the selection was replaced (the
			// reference block needs its ID) — if wiring it into the post failed,
			// remove it again rather than leaving an orphaned published pattern.
			if ( wpBlock?.id ) {
				deleteEntityRecord( 'postType', 'wp_block', wpBlock.id, { force: true } );
			}
			createErrorNotice(
				__( 'Could not apply the blueprint.', 'altis' ),
				{ type: 'snackbar' }
			);
		}
	};

	return (
		<BlockSettingsMenuControls>
			{ ( { selectedClientIds, onClose }: { selectedClientIds: string[], onClose: () => void } ) => {
				if ( ! isEligible( selectedClientIds ) ) {
					return null;
				}

				return (
					<>
						{ blueprints.map( blueprint => (
							<MenuItem
								key={ blueprint.id }
								icon={ AccelerateBlockIcon }
								onClick={ () => {
									apply( blueprint, selectedClientIds );
									onClose();
								} }
							>
								{ blueprint.title }
							</MenuItem>
						) ) }
					</>
				);
			} }
		</BlockSettingsMenuControls>
	);
}

registerPlugin( 'accelerate-blueprints-menu', {
	render: BlueprintsMenu,
} );
