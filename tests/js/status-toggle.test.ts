import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import StatusToggle from '../../src/audiences/ui/components/status-toggle';

vi.mock( '@wordpress/i18n', () => ( {
	__: ( value: string ) => value,
} ) );

describe( 'StatusToggle', () => {
	let container: HTMLDivElement;
	let root: Root;

	beforeAll( () => {
		( globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean } ).IS_REACT_ACT_ENVIRONMENT = true;
	} );

	beforeEach( () => {
		container = document.createElement( 'div' );
		document.body.appendChild( container );
		root = createRoot( container );
	} );

	afterEach( async () => {
		await act( async () => root.unmount() );
		container.remove();
	} );

	it( 'associates each label with its own switch', async () => {
		const onFirstChange = vi.fn();
		const onSecondChange = vi.fn();

		await act( async () => root.render(
			React.createElement(
				React.Fragment,
				null,
				React.createElement( StatusToggle, { compact: true, status: 'publish', onChange: onFirstChange } ),
				React.createElement( StatusToggle, { compact: true, status: 'draft', onChange: onSecondChange } )
			)
		) );

		const labels = container.querySelectorAll<HTMLLabelElement>( 'label' );
		const switches = container.querySelectorAll<HTMLButtonElement>( '[role="switch"]' );

		expect( switches ).toHaveLength( 2 );
		expect( labels ).toHaveLength( 2 );
		expect( labels[ 0 ].htmlFor ).toBe( switches[ 0 ].id );
		expect( labels[ 1 ].htmlFor ).toBe( switches[ 1 ].id );
		expect( switches[ 0 ].id ).not.toBe( switches[ 1 ].id );

		await act( async () => labels[ 1 ].click() );

		expect( onFirstChange ).not.toHaveBeenCalled();
		expect( onSecondChange ).toHaveBeenCalledWith( true );
	} );
} );
