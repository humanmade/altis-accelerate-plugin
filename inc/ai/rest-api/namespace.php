<?php

namespace Altis\Accelerate\AI\REST_API;

use Altis\Accelerate;
use Altis\Accelerate\Telemetry;
use GuzzleHttp\Client;
use WP_Error;
use WP_REST_Response;
use WP_REST_Request;

function bootstrap() : void {
	add_action( 'rest_api_init', __NAMESPACE__ . '\\register_rest_routes' );
}

function register_rest_routes() : void {
	$messages = [
		'type' => 'array',
		'required' => true,
		'items' => [
			'type' => [
				'object'
			],
			'properties' => [
				'role' => [
					'type' => 'string',
					'enum' => [
						'user',
						'assistant'
					],
				],
				'content' => [
					'type' => 'string',
					'required' => true,
				]
			],
		],
	];
	$post = [
		'type' => 'object',
		'properties' => [
			'title' => [
				'type' => 'string',
			],
			'content' => [
				'type' => 'string',
			],
			'type' => [
				'type' => 'string',
			],
		],
	];
	register_rest_route( 'ai/v1', 'insert', [
		[
			'methods' => 'POST',
			'callback' => __NAMESPACE__ . '\\insert_callback',
			'permission_callback' => function () : bool {
				return is_user_logged_in();
			},
			'args' => [
				'content' => [
					'type' => 'string',
				],
				'messages' => $messages,
				'post' => $post,
				'available_blocks' => [
					'type' => 'array',
					'items' => [
						'type' => 'string',
					],
				],
				'stream' => [
					'type' => 'boolean',
					'default' => false,
				],
			],
		]
	] );
	register_rest_route( 'ai/v1', 'summarize', [
		[
			'methods' => 'POST',
			'callback' => __NAMESPACE__ . '\\summarize_callback',
			'permission_callback' => function () : bool {
				return is_user_logged_in();
			},
			'args' => [
				'content' => [
					'type' => 'string',
				],
				'messages' => $messages,
				'post' => $post,
				'stream' => [
					'type' => 'boolean',
					'default' => false,
				],
			],
		]
	] );

	register_rest_route( 'ai/v1', 'chat', [
		[
			'methods' => 'POST',
			'callback' => __NAMESPACE__ . '\\chat_callback',
			'permission_callback' => function () : bool {
				return is_user_logged_in();
			},
			'args' => [
				'messages' => $messages,
				'post' => $post,
				'stream' => [
					'type' => 'boolean',
					'default' => false,
				],
			],
		]
	] );
}

/**
 * Get streaming client for Accelerate cloud.
 *
 * @return Client
 */
function get_streaming_client() : Client {
	static $client;

	if ( empty( $client ) ) {
		$client = new Client( [
			'base_uri' => 'https://eu.accelerate.altis.cloud/',
			'stream' => true,
		] );
	}

	return $client;
}

/**
 * Run an insertion call.
 *
 * This call returns Gutenberg blocks suitable for insertion into post
 * content. For example, calls to write content or replace existing content
 * with a rewritten version.
 *
 * @param WP_REST_Request $request
 * @return WP_REST_Response|WP_Error
 */
function insert_callback( WP_REST_Request $request ) {
	$params = $request->get_params();

	$params['site_title'] = get_bloginfo( 'name' );
	try {
		$response = get_streaming_client()->post( '/ai', [
			'json' => $params,
			'headers' => [
				'Authorization' => 'Bearer ' . Accelerate\get_altis_dashboard_oauth2_client_id(),
			],
		] );
	} catch ( Exception $e ) {
		return new WP_Error( 'request-error', $e->getMessage() );
	}
	if ( $request['stream'] ) {
		$message = handle_streamed_response( $response );
		Telemetry\track( [
			'event' => 'AI',
			'properties' => [
				'action' => 'Prompt',
				'messages' => $params['messages'],
				'response' => $message,
			],
		] );
		exit;
	}
	$response = $response->getBody()->getContents();
	$response = json_decode( $response );

	Telemetry\track( [
		'event' => 'AI',
		'properties' => [
			'action' => 'Prompt',
			'messages' => $params['messages'],
			'response' => $response->choices[0]->message,
		],
	] );

	return rest_ensure_response( $response->choices[0]->message );
}

/**
 * Run a summarize AI call.
 *
 * This call returns plain text data suitable for use in any field,
 * particularly post metadata (like the excerpt or SEO fields).
 */
function summarize_callback( WP_REST_Request $request ) {
	$params = $request->get_params();
	$params['site_title'] = get_bloginfo( 'name' );
	$params['query'] = 'summary';

	$response = get_streaming_client()->post( '/ai', [
		'json' => $params,
		'headers' => [
			'Authorization' => 'Bearer ' . Accelerate\get_altis_dashboard_oauth2_client_id(),
		],
	] );

	if ( $request['stream'] ) {
		$message = handle_streamed_response( $response );
		Telemetry\track( [
			'event' => 'AI',
			'properties' => [
				'action' => 'Summary',
				'messages' => $params['messages'],
				'response' => $message,
			],
		] );
		exit;
	}
	$response = $response->getBody()->getContents();
	$response = json_decode( $response );
	Telemetry\track( [
		'event' => 'AI',
		'properties' => [
			'action' => 'Summary',
			'messages' => $params['messages'],
			'response' =>$response->choices[0]->message,
		],
	] );
	return rest_ensure_response( $response->choices[0]->message );
}


/**
 * Run a Chat AI call.
 */
function chat_callback( WP_REST_Request $request ) {
	$params = $request->get_params();
	$params['site_title'] = get_bloginfo( 'name' );
	$params['query'] = 'chat';

	$response = get_streaming_client()->post( '/ai', [
		'json' => $params,
		'headers' => [
			'Authorization' => 'Bearer ' . Accelerate\get_altis_dashboard_oauth2_client_id(),
		],
	] );

	if ( $request['stream'] ) {
		$message = handle_streamed_response( $response );
		Telemetry\track( [
			'event' => 'AI',
			'properties' => [
				'action' => 'Chat',
				'messages' => $params['messages'],
				'response' => $message,
			],
		] );
		exit;
	}
	$response = $response->getBody()->getContents();
	$response = json_decode( $response );
	Telemetry\track( [
		'event' => 'AI',
		'properties' => [
			'action' => 'Chat',
			'messages' => $params['messages'],
			'response' =>$response->choices[0]->message,
		],
	] );
	return rest_ensure_response( $response->choices[0]->message );
}

/**
 * Handle a stream response by streaming via SSE.
 *
 * @param \Psr\Http\Message\ResponseInterface $response Guzzle response to stream.
 * @return never
 */
function handle_streamed_response( $response ) : string {
	ini_set( 'output_buffering', 'off' ); // @codingStandardsIgnoreLine
	ini_set( 'zlib.output_compression', false ); // @codingStandardsIgnoreLine
	header( 'X-Accel-Buffering: no' );
	header( 'Content-Encoding: none' );
	header( 'Content-Type: text/event-stream' );

	$body = $response->getBody();
	$buffer = '';
	$id = 1;
	$message = '';

	while ( ! $body->eof() ) {
		$buffer .= $body->read( 1024 );

		// Find the position of the last complete line in the buffer
		$last_newline_pos = strrpos( $buffer, "\n" );

		// If there's at least one complete line, process and echo it
		if ($last_newline_pos !== false) {
			$complete_lines = substr( $buffer, 0, $last_newline_pos + 1 );

			// We parse the json each line with data: at the start, and
			// extract just the message.
			$lines = explode( "\n", $complete_lines );
			foreach ( $lines as $line ) {
				if ( ! empty( $line ) && substr( $line, 0, 5 ) === 'data:' ) {
					$line = json_decode( substr( $line, 6 ) );
					if ( ! empty( $line->choices[0]->delta->content ) ) {
						$message .= $line->choices[0]->delta->content;
						$id++;
						printf( "id: %d\n", $id ); // phpcs:ignore
						echo "event: chat\n"; // phpcs:ignore
						echo 'data: ' . wp_json_encode( [ 'role' => 'assistant', 'content' => $line->choices[0]->delta->content ] ) . "\n\n";
						flush();
						wp_ob_end_flush_all();
					}
				}
			}
			flush();
			wp_ob_end_flush_all();
			$buffer = substr( $buffer, $last_newline_pos + 1 );

		}
	}

	return $message;
}
