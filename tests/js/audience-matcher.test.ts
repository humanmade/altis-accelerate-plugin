/**
 * Audience matcher tests — operator truth-table parity + the known
 * server/client divergences flagged in `docs/test-coverage-audit.md`.
 *
 * The truth table at `tests/fixtures/audience-operators.json` is shared with
 * the PHP suite (`tests/phpunit/AudienceEvaluationTest.php`). Any row added
 * there is automatically picked up here.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { evaluateOperator, matchAudiences } from '../../src/audience-matcher.js';

type Row = {
	name: string;
	operator: string;
	field_value: unknown;
	rule_value: unknown;
	expected: boolean;
};

const fixturePath = join( __dirname, '../fixtures/audience-operators.json' );
const { rows } = JSON.parse( readFileSync( fixturePath, 'utf8' ) ) as { rows: Row[] };

describe( 'evaluateOperator — operator truth table', () => {
	for ( const row of rows ) {
		it( row.name, () => {
			expect( evaluateOperator( row.operator, row.field_value, row.rule_value ) ).toBe( row.expected );
		} );
	}
} );

describe( 'evaluateOperator — unknown operator', () => {
	it( 'returns false for an unknown operator (silent skip; PHP string branch matches this)', () => {
		expect( evaluateOperator( 'matches_regex', 'US', 'US' ) ).toBe( false );
	} );
} );

describe( 'matchAudiences — group/audience composition', () => {
	const fieldData = {
		attributes: {
			country: 'US',
			plan: 'pro',
		},
		metrics: { sessions: 5 },
		endpoint: {},
	};

	const audience = ( id: number, include: 'any' | 'all' | 'none', groups: any[] ) => ( {
		[id]: {
			id,
			config: {
				include,
				groups,
			},
		},
	} );

	it( 'matches when a single ANY group has a matching rule', () => {
		const audiences = audience( 1, 'any', [
			{
				include: 'any',
				rules: [ {
					field: 'attributes.country',
					operator: '=',
					value: 'US',
				} ],
			},
		] );
		expect( matchAudiences( audiences, fieldData ) ).toEqual( [ 1 ] );
	} );

	it( 'does not match when the rule fails', () => {
		const audiences = audience( 2, 'any', [
			{
				include: 'any',
				rules: [ {
					field: 'attributes.country',
					operator: '=',
					value: 'UK',
				} ],
			},
		] );
		expect( matchAudiences( audiences, fieldData ) ).toEqual( [] );
	} );

	it( 'ALL requires every rule in the group to pass', () => {
		const passes = audience( 3, 'any', [
			{
				include: 'all',
				rules: [
					{
						field: 'attributes.country',
						operator: '=',
						value: 'US',
					},
					{
						field: 'attributes.plan',
						operator: '=',
						value: 'pro',
					},
				],
			},
		] );
		expect( matchAudiences( passes, fieldData ) ).toEqual( [ 3 ] );

		const fails = audience( 4, 'any', [
			{
				include: 'all',
				rules: [
					{
						field: 'attributes.country',
						operator: '=',
						value: 'US',
					},
					{
						field: 'attributes.plan',
						operator: '=',
						value: 'free',
					},
				],
			},
		] );
		expect( matchAudiences( fails, fieldData ) ).toEqual( [] );
	} );

	it( 'preserves declaration order in the matched IDs list', () => {
		const audiences = {
			...audience( 7, 'any', [ {
				include: 'any',
				rules: [ {
					field: 'attributes.country',
					operator: '=',
					value: 'US',
				} ],
			} ] ),
			...audience( 8, 'any', [ {
				include: 'any',
				rules: [ {
					field: 'attributes.country',
					operator: '=',
					value: 'US',
				} ],
			} ] ),
		};
		expect( matchAudiences( audiences, fieldData ) ).toEqual( [ 7, 8 ] );
	} );

	it( 'skips rules with empty field names without short-circuiting the group', () => {
		const audiences = audience( 5, 'any', [
			{
				include: 'all',
				rules: [
					{
						field: '',
						operator: '=',
						value: 'anything',
					},
					{
						field: 'attributes.country',
						operator: '=',
						value: 'US',
					},
				],
			},
		] );
		expect( matchAudiences( audiences, fieldData ) ).toEqual( [ 5 ] );
	} );
} );

describe( 'evaluateRule — null short-circuit (preserved from legacy inline matcher)', () => {
	// The original inline matcher in accelerate.js breaks the value-iteration
	// loop in THREE cases: ruleMatch=true, currentValue=null, or rule value=null.
	// The null short-circuits mean an array like `[null, 'US']` STOPS at the
	// first null without testing 'US'. These tests pin that behaviour so a
	// future "clean up" of the extracted matcher can't silently change it.
	const fieldData = {
		attributes: { mixed: [ null, 'US' ] },
		metrics: {},
		endpoint: {},
	};

	it( 'array with leading null stops before testing later values (= operator)', () => {
		const audiences = {
			1: {
				id: 1,
				config: {
					include: 'any',
					groups: [
						{
							include: 'any',
							rules: [ {
								field: 'attributes.mixed',
								operator: '=',
								value: 'US',
							} ],
						},
					],
				},
			},
		};
		// First iter: ruleMatch = null === 'US' → false. currentValue === null → break.
		// 'US' is never tested. Audience does not match.
		expect( matchAudiences( audiences, fieldData ) ).toEqual( [] );
	} );

	it( 'rule value of null short-circuits after the first iteration', () => {
		const audiences = {
			1: {
				id: 1,
				config: {
					include: 'any',
					groups: [
						// Two non-null values; rule value is null. After first
						// iter, the `if (value === null) break` short-circuits.
						{
							include: 'any',
							rules: [ {
								field: 'attributes.country',
								operator: 'gte',
								value: null,
							} ],
						},
					],
				},
			},
		};
		expect( matchAudiences( audiences, {
			attributes: { country: 'US' },
			metrics: {},
			endpoint: {},
		} ) ).toEqual( [] );
	} );
} );

describe( 'matchAudiences — known divergences from the PHP server-side evaluator', () => {
	// These tests document the differences flagged by the audit + codex review.
	// They are CHARACTERISATION — they assert today's client behaviour, not
	// the intended behaviour. When a divergence is fixed, flip the assertion.

	it( 'client does not match audiences with include: \'none\' (PHP allows it)', () => {
		// Server: ` AND NOT ` join. Client: matcher only checks 'all' / 'any'.
		const fieldData = {
			attributes: { country: 'US' },
			metrics: {},
			endpoint: {},
		};
		const audiences = {
			1: {
				id: 1,
				config: {
					include: 'none',
					groups: [
						{
							include: 'any',
							rules: [ {
								field: 'attributes.country',
								operator: '=',
								value: 'UK',
							} ],
						},
					],
				},
			},
		};
		// A "match nothing in this group" audience that the server WOULD match
		// (country is not UK) — but the client returns [] because 'none' is
		// not modelled.
		expect( matchAudiences( audiences, fieldData ) ).toEqual( [] );
	} );

	it( 'client returns true for `!=` on an array field where ANY value differs (PHP returns false)', () => {
		// Server SQL: `not has(visitedCountries, 'US')` → false because 'US' IS in the array.
		// Client: iterates ['US','CA'], second iter `'CA' !== 'US'` → true → break.
		const fieldData = {
			attributes: { visitedCountries: [ 'US', 'CA' ] },
			metrics: {},
			endpoint: {},
		};
		const audiences = {
			1: {
				id: 1,
				config: {
					include: 'any',
					groups: [
						{
							include: 'any',
							rules: [ {
								field: 'attributes.visitedCountries',
								operator: '!=',
								value: 'US',
							} ],
						},
					],
				},
			},
		};
		expect( matchAudiences( audiences, fieldData ) ).toEqual( [ 1 ] );
	} );
} );
