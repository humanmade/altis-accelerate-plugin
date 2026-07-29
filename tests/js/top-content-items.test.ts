/**
 * Tests for the BreakdownPanel "Top content" tile row mapper.
 *
 * toContentItems maps view-ranked /accelerate/v1/top posts to HostList rows:
 * post id → stable row key, views → value, decoded title → label (with a
 * localized fallback for untitled posts), capped at the row limit.
 */

import { describe, expect, it } from 'vitest';

import { TopPost, toContentItems } from '../../src/accelerate/content-explorer/BreakdownPanel/toContentItems';

const post = ( id: number, title: string, views: number ): TopPost => ( {
	id,
	title,
	views,
} );

describe( 'toContentItems', () => {
	it( 'maps id → key (string), views → value, title → label', () => {
		expect( toContentItems( [ post( 42, 'Hello World', 1234 ) ] ) ).toEqual( [
			{
				key: '42',
				value: 1234,
				label: 'Hello World',
			},
		] );
	} );

	it( 'decodes HTML entities in titles', () => {
		const [ row ] = toContentItems( [ post( 1, 'Tips &amp; Tricks &#8217;25', 9 ) ] );
		expect( row.label ).toBe( 'Tips & Tricks ’25' );
	} );

	it( 'falls back to a placeholder for untitled posts', () => {
		expect( toContentItems( [ post( 7, '', 3 ) ] )[ 0 ].label ).toBe( '(no title)' );
	} );

	it( 'preserves the incoming view-ranked order', () => {
		const items = toContentItems( [ post( 1, 'a', 30 ), post( 2, 'b', 20 ), post( 3, 'c', 10 ) ] );
		expect( items.map( i => i.key ) ).toEqual( [ '1', '2', '3' ] );
	} );

	it( 'caps the list at 10 rows by default', () => {
		const many = Array.from( { length: 25 }, ( _v, i ) => post( i + 1, `p${ i }`, 100 - i ) );
		expect( toContentItems( many ) ).toHaveLength( 10 );
	} );

	it( 'honours an explicit limit', () => {
		const many = Array.from( { length: 25 }, ( _v, i ) => post( i + 1, `p${ i }`, 100 - i ) );
		expect( toContentItems( many, 3 ) ).toHaveLength( 3 );
	} );

	it( 'returns an empty array for no posts', () => {
		expect( toContentItems( [] ) ).toEqual( [] );
	} );
} );
