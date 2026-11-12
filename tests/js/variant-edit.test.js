import { describe, expect, it, vi } from 'vitest';

import { mapSelectToProps } from '../../src/global-blocks/blocks/variant/map-select-to-props';

/**
 * Create a fake `select` over a small block tree.
 *
 * @param {object} options The fake editor state.
 * @param {Array} options.blocks Root level blocks, each with optional innerBlocks.
 * @param {object} options.post The current post.
 * @param {object} options.settings The block editor settings.
 * @param {object} options.preferences Map of preference key to value.
 * @returns {object} The `select` function and the preferences `get` mock.
 */
const createSelect = ( { blocks, post, settings = {}, preferences = {} } ) => {
	const parents = {};
	const byId = {};
	const index = ( list, parentId ) => list.forEach( block => {
		byId[ block.clientId ] = block;
		parents[ block.clientId ] = parentId;
		index( block.innerBlocks || [], block.clientId );
	} );
	index( blocks, '' );

	const siblings = rootClientId => rootClientId ? byId[ rootClientId ].innerBlocks || [] : blocks;
	const get = vi.fn( ( scope, key ) => preferences[ key ] );
	const getEditedEntityRecord = vi.fn( ( kind, name, id ) => ( { id } ) );

	const stores = {
		'core/block-editor': {
			getBlockOrder: clientId => siblings( clientId ).map( block => block.clientId ),
			getBlocks: rootClientId => siblings( rootClientId ),
			getSelectedBlock: () => null,
			getBlock: clientId => byId[ clientId ] || null,
			getBlockIndex: clientId => siblings( parents[ clientId ] ).indexOf( byId[ clientId ] ),
			getBlockRootClientId: clientId => parents[ clientId ] ?? null,
			getSettings: () => settings,
		},
		core: {
			getEditedEntityRecord,
		},
		'core/editor': {
			getCurrentPost: () => post,
		},
		'core/preferences': { get },
	};

	return {
		select: storeName => stores[ storeName ],
		get,
		getEditedEntityRecord,
	};
};

const variant = clientId => ( {
	clientId,
	name: 'altis/variant',
	attributes: {},
	innerBlocks: [],
} );
const page = {
	id: 5,
	type: 'page',
};

describe( 'variant edit mapSelectToProps', () => {
	it( 'shows only the first variant in preview mode without reading preferences', () => {
		const { select, get, getEditedEntityRecord } = createSelect( {
			blocks: [ variant( 'a' ), variant( 'b' ) ],
			post: page,
			settings: { isPreviewMode: true },
		} );

		let first;
		let second;
		expect( () => {
			first = mapSelectToProps( select, { clientId: 'a' } );
			second = mapSelectToProps( select, { clientId: 'b' } );
		} ).not.toThrow();

		expect( first.isPreviewMode ).toBe( true );
		expect( first.isVisible ).toBe( true );
		expect( second.isVisible ).toBe( false );
		expect( get ).not.toHaveBeenCalled();
		expect( getEditedEntityRecord ).not.toHaveBeenCalled();
	} );

	it( 'detects preview mode from the legacy unstable setting', () => {
		const { select } = createSelect( {
			blocks: [ variant( 'a' ), variant( 'b' ) ],
			post: page,
			settings: { __unstableIsPreviewMode: true },
		} );

		expect( mapSelectToProps( select, { clientId: 'a' } ).isPreviewMode ).toBe( true );
	} );

	it( 'shows the variant selected in preferences when editing', () => {
		const { select, get } = createSelect( {
			blocks: [
				{
					clientId: 'parent',
					name: 'core/block',
					attributes: { ref: 123 },
					innerBlocks: [ variant( 'a' ), variant( 'b' ) ],
				},
			],
			post: page,
			preferences: { '123:variant': 1 },
		} );

		const first = mapSelectToProps( select, { clientId: 'a' } );
		const second = mapSelectToProps( select, { clientId: 'b' } );

		expect( get ).toHaveBeenCalledWith( 'altis/global-blocks', '123:variant' );
		expect( first.isPreviewMode ).toBe( false );
		expect( first.isVisible ).toBe( false );
		expect( second.isVisible ).toBe( true );
		expect( second.selectedVariantBlockIndex ).toBe( 1 );
	} );

	it( 'gives a variant with no parent pattern the same empty parent post as core', () => {
		const { select, getEditedEntityRecord } = createSelect( {
			blocks: [ variant( 'a' ), variant( 'b' ) ],
			post: page,
		} );

		let props;
		expect( () => {
			props = mapSelectToProps( select, { clientId: 'a' } );
		} ).not.toThrow();

		// The dispatch callbacks read `parentPost.id`, which is safe on false.
		expect( props.parentPost ).toBe( false );
		expect( getEditedEntityRecord ).not.toHaveBeenCalled();
	} );

	it( 'uses the pattern id for the preference key when editing the pattern', () => {
		const { select, get } = createSelect( {
			blocks: [ variant( 'a' ), variant( 'b' ) ],
			post: {
				id: 77,
				type: 'wp_block',
			},
			preferences: { '77:variant': 1 },
		} );

		const props = mapSelectToProps( select, { clientId: 'b' } );

		expect( get ).toHaveBeenCalledWith( 'altis/global-blocks', '77:variant' );
		expect( props.isGlobalBlockPost ).toBe( true );
		expect( props.parentPost.id ).toBe( 77 );
		expect( props.isVisible ).toBe( true );
	} );
} );
