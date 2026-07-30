<?php
/**
 * HubSpot API client.
 *
 * Minimal, read-only: just enough to validate a private app token and build
 * the form / marketing-email ID → name directories. Required private app
 * scopes: Forms (read) and Marketing Email (read).
 *
 * @package altis/accelerate
 */

namespace Altis\Accelerate\Integrations\HubSpot;

use WP_Error;

const API_BASE = 'https://api.hubapi.com';
const PAGE_SIZE = 100;

// Pagination safety valve — 50 pages × 100 = 5000 assets, far beyond the
// DIRECTORY_CAP actually shipped to the client.
const MAX_PAGES = 50;

/**
 * Perform an authenticated GET against the HubSpot API.
 *
 * @param string $token Private app access token.
 * @param string $path API path including any query string.
 * @return array|WP_Error Decoded JSON body.
 */
function api_get( string $token, string $path ) {
	$response = wp_remote_get( API_BASE . $path, [
		'timeout' => 15,
		'headers' => [
			'Authorization' => 'Bearer ' . $token,
			'Content-Type' => 'application/json',
		],
	] );

	if ( is_wp_error( $response ) ) {
		return $response;
	}

	$code = wp_remote_retrieve_response_code( $response );
	$body = json_decode( wp_remote_retrieve_body( $response ), true );

	if ( $code !== 200 ) {
		// HubSpot error payloads carry a human-readable `message`
		// (e.g. missing scopes) — surface it in the settings UI.
		$message = is_array( $body ) && ! empty( $body['message'] )
			? $body['message']
			: sprintf( 'HubSpot API returned HTTP %d', $code );
		return new WP_Error( 'hubspot.api_error', $message, [ 'status' => $code ] );
	}

	return is_array( $body ) ? $body : [];
}

/**
 * Fetch all pages of a HubSpot v3 collection endpoint.
 *
 * @param string $token Private app access token.
 * @param string $path Collection path, e.g. '/marketing/v3/forms/'.
 * @return array|WP_Error Flat array of result objects.
 */
function api_get_all( string $token, string $path ) {
	$results = [];
	$after = null;

	for ( $page = 0; $page < MAX_PAGES; $page++ ) {
		$query = add_query_arg( array_filter( [
			'limit' => PAGE_SIZE,
			'after' => $after,
		] ), $path );

		$body = api_get( $token, $query );
		if ( is_wp_error( $body ) ) {
			return $body;
		}

		$results = array_merge( $results, $body['results'] ?? [] );

		$after = $body['paging']['next']['after'] ?? null;
		if ( ! $after ) {
			break;
		}
	}

	return $results;
}

/**
 * Validate a private app token with a minimal read call.
 *
 * @param string $token Private app access token.
 * @return true|WP_Error
 */
function validate_token( string $token ) {
	$result = api_get( $token, '/marketing/v3/forms/?limit=1' );
	if ( is_wp_error( $result ) ) {
		return $result;
	}
	return true;
}

/**
 * Build the form GUID → name directory.
 *
 * @param string $token Private app access token.
 * @return array|WP_Error
 */
function fetch_forms_directory( string $token ) {
	$forms = api_get_all( $token, '/marketing/v3/forms/' );
	if ( is_wp_error( $forms ) ) {
		return $forms;
	}

	$directory = [];
	foreach ( $forms as $form ) {
		if ( ! empty( $form['id'] ) && isset( $form['name'] ) ) {
			$directory[ (string) $form['id'] ] = (string) $form['name'];
		}
	}

	return $directory;
}

/**
 * Build the marketing email ID → name directory.
 *
 * The `_hsmi` URL param on email links is matched against these IDs at
 * capture time; unmatched IDs are stored raw.
 *
 * @param string $token Private app access token.
 * @return array|WP_Error
 */
function fetch_emails_directory( string $token ) {
	$emails = api_get_all( $token, '/marketing/v3/emails/' );
	if ( is_wp_error( $emails ) ) {
		return $emails;
	}

	$directory = [];
	foreach ( $emails as $email ) {
		if ( ! empty( $email['id'] ) && isset( $email['name'] ) ) {
			$directory[ (string) $email['id'] ] = (string) $email['name'];
		}
	}

	return $directory;
}
