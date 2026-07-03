import apiFetch, { APIFetchOptions } from '@wordpress/api-fetch';
import { register, select } from '@wordpress/data';

import { store } from '../src/data';
import { fixtureRoutes, FixtureRouteMatcher, FixtureRouteResponse } from '../src/fixtures';

const normalizePath = ( value: string ) => {
	const url = new URL( value, window.location.origin );
	return `${ url.pathname.replace( /^\/wp-json\//, '/' ) }${ url.search }`;
};

const getRequestPath = ( options: APIFetchOptions ) => {
	const value = options.path || options.url || window.location.href;
	return normalizePath( String( value ) );
};

const matchesRoute = ( matcher: FixtureRouteMatcher, path: string ) => {
	if ( typeof matcher === 'string' ) {
		return matcher === path;
	}
	return matcher.test( path );
};

const findRoute = ( path: string ) : FixtureRouteResponse | null => {
	for ( const [ matcher, response ] of fixtureRoutes ) {
		if ( matchesRoute( matcher, path ) ) {
			return response;
		}
	}
	return null;
};

const createResponse = ( route: FixtureRouteResponse ) => new Response(
	JSON.stringify( route.body ),
	{
		status: route.status || 200,
		headers: {
			'Content-Type': 'application/json',
			...( route.headers || {} ),
		},
	}
);

if ( ! select( 'accelerate' ) ) {
	register( store );
}

apiFetch.setFetchHandler( async options => {
	const path = getRequestPath( options );
	const route = findRoute( path );

	if ( ! route ) {
		const error = {
			code: 'storybook_fixture_missing',
			message: `No Storybook fixture route matched ${ path }`,
			path,
		};
		// eslint-disable-next-line no-console
		console.error( error.message, options );
		return Promise.reject( error );
	}

	const response = createResponse( route );

	if ( options.parse === false ) {
		return response;
	}

	if ( ! response.ok ) {
		return Promise.reject( await response.json() );
	}

	return response.json();
} );
