/**
 * Pure audience-rule evaluation, extracted from src/accelerate.js so it can
 * be unit-tested without the analytics pipeline, browser globals, or async
 * attribute/metric preparation.
 *
 * **Behaviour is preserved verbatim from the inline matcher in `accelerate.js`.**
 * If you change anything here, change the consumer at the same time and add
 * a test row to `tests/fixtures/audience-operators.json`.
 *
 * Known divergences from the PHP query builder (`inc/audiences/namespace.php
 * ::build_audience_query`) — these are documented, not fixed, in slice 1
 * of the test-coverage audit. See `docs/test-coverage-audit.md` P0 #1:
 *
 *   1. `include: 'none'` is allowed by the audience JSON schema and used
 *      server-side (` AND NOT ` join), but is NOT modelled here. An audience
 *      or group with `include: 'none'` will currently never match on the
 *      client because the matcher only checks 'all' and 'any'.
 *
 *   2. Array-field `!=` semantics differ. Server uses `not has(field, value)`
 *      (false if the array contains `value`). The client iterates values
 *      and breaks on the first match — so `field=['US','CA']`, rule
 *      `!= 'US'` evaluates TRUE here (because 'CA' !== 'US' on iteration 2)
 *      but FALSE in PHP.
 *
 *   3. Unknown operators silently leave `ruleMatch=false`. The PHP string
 *      branch also silently skips the rule; the PHP numeric branch defaults
 *      to `=`. Pinned here so we notice if it changes.
 *
 * ONE intentional deviation from the original inline matcher:
 *   - `lookupField()` uses optional chaining, so a deeply-missing path
 *     returns `null` instead of throwing `TypeError`. The original would
 *     crash on any missing intermediate segment. This is a defensive
 *     improvement, not a behaviour pin.
 */

/**
 * Look up a dotted field path inside the aggregated field data.
 *
 * @param {string} field Dot-notation path, e.g. `endpoint.Demographic.Country`.
 * @param {object} fieldData Aggregated `{attributes, metrics, endpoint}` object.
 * @returns {*} The resolved value, or null if any segment is missing.
 */
function lookupField( field, fieldData ) {
	return field.split( '.' ).reduce( ( carry, prop ) => {
		return carry?.[ prop ] ?? null;
	}, fieldData );
}

/**
 * Evaluate a single rule against a single value. Returns the rule match for
 * THAT value only; the array-walking logic that breaks on first match lives
 * in `evaluateRule()`.
 *
 * @param {string} operator One of `=`, `!=`, `*=`, `!*`, `^=`, `gte`, `lte`,
 *   `gt`, `lt`. Unknown operators return false.
 * @param {*} currentValue The visitor field value.
 * @param {*} ruleValue The rule's right-hand-side value.
 * @returns {boolean} Whether the value satisfies the rule.
 */
export function evaluateOperator( operator, currentValue, ruleValue ) {
	let ruleMatch = false;

	if ( operator === '=' ) {
		ruleMatch = currentValue === ruleValue;
	}
	if ( operator === '!=' ) {
		ruleMatch = currentValue !== ruleValue;
	}

	if ( currentValue === null ) {
		return ruleMatch;
	}

	if ( operator === '*=' ) {
		ruleMatch = currentValue.indexOf( ruleValue ) > -1;
	}
	if ( operator === '!*' ) {
		ruleMatch = currentValue.indexOf( ruleValue ) === -1;
	}
	if ( operator === '^=' ) {
		ruleMatch = currentValue.indexOf( ruleValue ) === 0;
	}

	if ( ruleValue === null ) {
		return ruleMatch;
	}

	if ( operator === 'gte' ) {
		ruleMatch = Number( currentValue ) >= Number( ruleValue );
	}
	if ( operator === 'lte' ) {
		ruleMatch = Number( currentValue ) <= Number( ruleValue );
	}
	if ( operator === 'gt' ) {
		ruleMatch = Number( currentValue ) > Number( ruleValue );
	}
	if ( operator === 'lt' ) {
		ruleMatch = Number( currentValue ) < Number( ruleValue );
	}

	return ruleMatch;
}

/**
 * Evaluate a single rule against a (possibly array-valued) field. Iterates
 * the values, breaking on the first match OR on the first null value/rule —
 * this mirrors the legacy inline matcher's three break conditions exactly
 * and is the source of the `!=` array divergence noted in the file header.
 *
 * @param {object} rule  `{field, operator, value}`.
 * @param {object} fieldData Aggregated `{attributes, metrics, endpoint}`.
 * @param {object} fieldValuesCache Per-evaluation lookup cache (mutated).
 * @returns {boolean|null} Whether the rule matched, or null if the rule had
 *   an empty field (caller should treat null as "skipped", not "no match").
 */
export function evaluateRule( rule, fieldData, fieldValuesCache = {} ) {
	const { field, operator, value } = rule;

	if ( field === '' ) {
		return null;
	}

	let currentValues = fieldValuesCache[ field ] || lookupField( field, fieldData );

	if ( ! Array.isArray( currentValues ) ) {
		currentValues = [ currentValues ];
	}

	fieldValuesCache[ field ] = currentValues;

	let ruleMatch = false;
	for ( const vid in currentValues ) {
		const currentValue = currentValues[ vid ];
		ruleMatch = evaluateOperator( operator, currentValue, value );

		// The original inline matcher breaks the value-loop in three cases.
		// Preserve all three so array-valued fields containing nulls (or
		// rules with null values) stop after the first such value, exactly
		// as before.
		if ( currentValue === null ) {
			break;
		}
		if ( value === null ) {
			break;
		}
		if ( ruleMatch ) {
			break;
		}
	}

	return ruleMatch;
}

/**
 * Match a set of audiences against a visitor's field data.
 *
 * @param {object} audiences `{ [aid]: {id, config} }` — same shape as the
 *   `Altis.Analytics.Audiences` global.
 * @param {object} fieldData Aggregated `{attributes, metrics, endpoint}`.
 * @returns {Array<number|string>} The IDs of audiences that matched, in the
 *   order they were declared in `audiences`.
 */
export function matchAudiences( audiences, fieldData ) {
	const audienceIds = [];
	const fieldValuesCache = {};

	for ( const aid in audiences ) {
		const { id, config } = audiences[ aid ];

		// Initial state mirrors the original: starts true for `all`, false
		// otherwise (which includes the unsupported `none` case — see header).
		let audienceMatched = config.include === 'all';

		for ( const gid in config.groups ) {
			const group = config.groups[ gid ];
			let groupMatched = group.include === 'all';

			for ( const rid in group.rules ) {
				const ruleMatch = evaluateRule( group.rules[ rid ], fieldData, fieldValuesCache );

				// `null` = skipped rule (empty field name).
				if ( ruleMatch === null ) {
					continue;
				}

				if ( group.include === 'any' && ruleMatch ) {
					groupMatched = true;
					break;
				}
				if ( group.include === 'all' && ! ruleMatch ) {
					groupMatched = false;
					break;
				}
			}

			if ( config.include === 'any' && groupMatched ) {
				audienceMatched = true;
				break;
			}
			if ( config.include === 'all' && ! groupMatched ) {
				audienceMatched = false;
				break;
			}
		}

		if ( audienceMatched ) {
			audienceIds.push( id );
		}
	}

	return audienceIds;
}
