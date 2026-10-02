/**
 * Format engaged seconds as a human-readable duration using the two largest
 * applicable units (the standard treatment for duration totals — YouTube
 * watch time, GA4 engagement durations). Lower-order units are dropped as the
 * magnitude grows: at an hour-plus, seconds are noise; at a day-plus, so are
 * minutes.
 *
 * Examples: 45 → "45s", 134 → "2m 14s", 26_760 → "7h 26m", 313_200 → "3d 15h"
 */
export function formatEngaged( seconds: number ): string {
	const s = Math.round( seconds );
	if ( s < 60 ) {
		return `${ s }s`;
	}
	if ( s < 3600 ) {
		return `${ Math.floor( s / 60 ) }m ${ s % 60 }s`;
	}
	if ( s < 86400 ) {
		return `${ Math.floor( s / 3600 ) }h ${ Math.floor( ( s % 3600 ) / 60 ) }m`;
	}
	return `${ Math.floor( s / 86400 ) }d ${ Math.floor( ( s % 86400 ) / 3600 ) }h`;
}
