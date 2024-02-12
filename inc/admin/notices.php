<?php
/**
 * Altis Accelerate Admin UI.
 */

namespace Altis\Accelerate\Admin\Notices;

use Altis\Accelerate;

const USER_GUIDE_URL = 'https://altis-dxp.notion.site/altis-dxp/Altis-Accelerate-Guide-90581042329742538523ebddb41f1d4f';
const USER_GUIDE_BROADCAST_URL = 'https://altis-dxp.notion.site/Broadcast-Blocks-8a9f83b64a8a486a867c1bd82a8a1977';

/**
 * Setup accelerate admin notices.
 *
 * @return void
 */
function setup() {
	add_action( 'admin_footer', __NAMESPACE__ . '\\action_admin_footer' );
}

/**
 * Outputs a dismissable page notice.
 *
 * @return void
 */
function get_page_notice() : void {
	$screen = get_current_screen();
	$notice_id = $screen->id;

	$notices = [
		'dashboard' => [
			'dismissable' => true,
			'heading' => __( 'Welcome to Altis Accelerate (Beta)', 'altis' ),
			'subheading' => '',
			'body' => '<p>'
				. __( 'Extend your <strong>WordPress blocks</strong> with the Altis Accelerate plugin. Built by one of WordPress’s most experienced agencies, these features bring together MarTech learnings into a solution powered by its own block-level analytics.', 'altis' )
				. '</p>'
				. '<ul><li>'
				. __( 'Broadcast, distribute blocks quickly to the rest of your site.', 'altis' )
				. '</li><li>'
				. __('Experimentation, a/b test different block, post title and featured image variants.', 'altis' )
				. '</li><li>'
				. __( 'Personalization, create different block variants for many audiences.', 'altis' )
				. '</li></ul><p>'
				. sprintf(
					__( 'Please refer to the <a href="%s" target="_accelerate">User Guide</a> for more information.', 'altis' ),
					USER_GUIDE_URL
				),
			'image' => plugins_url( 'assets/hiking.png', Accelerate\PLUGIN_FILE ),
			'cta' => false,
		],
		'edit-broadcast' => [
			'dismissable' => true,
			'heading' => 'Introducing Broadcasts',
			'subheading' => '',
			'body' => '<p>'
				. __( 'Broadcast are dynamic areas capable of holding multiple other blocks in rotation, for the purpose of internal advertising. These broadcast areas can be added via the editor (Broadcast Blocks), or via code directly into templates.', 'altis' )
				. '</p><p>'
				. __('Once you have a broadcast block in place, you can promote any new content or campaigns within seconds to your entire site — talk about scaling traffic and testing new content instantly.', 'altis' )
				. '</p><p>'
				. sprintf(
					__( 'Please refer to the <a href="%s" target="_accelerate">User Guide - Broadcasts</a> for more information.', 'altis' ),
					USER_GUIDE_BROADCAST_URL
				)
				. '</p>',
			'image' => plugins_url( 'assets/broadcasts.png', Accelerate\PLUGIN_FILE ),
			'cta' => false,
		],
		'accelerate_page_altis-accelerate-settings' => [
			'dismissable' => false,
			'heading' => __( 'Welcome to Altis Accelerate', 'altis' ),
			'subheading' => __( 'Unlock marketing within WordPress', 'altis' ),
			'body' => '<p>' . __( 'If you already have an account you can login via the button below. If you don\'t, creating an account takes just a few moments.', 'altis' ) . '</p>',
			'image' => plugins_url( 'assets/hiking.png', Accelerate\PLUGIN_FILE ),
			'cta' => [
				'label' => __( 'Create your account now', 'altis' ),
				'link' => Accelerate\get_altis_dashboard_authorize_url(),
			],
			'condition' => function () {
				return empty( Accelerate\get_altis_dashboard_access_token() );
			}
		],
	];

	// Special handling for Content Explorer page.
	if ( $notice_id === 'toplevel_page_accelerate' ) {
		$notice_id = 'dashboard';
	}

	if ( ! isset( $notices[ $notice_id ] ) ) {
		return;
	}

	if ( get_user_setting( "altis-notice-dismissed-{$notice_id}" ) ) {
		return;
	}

	$notice = wp_parse_args( $notices[ $notice_id ], [
		'dismissable' => false,
		'heading' => '',
		'subheading' => '',
		'body' => '',
		'image' => '',
		'cta' => false,
		'condition' => '__return_true',
	] );

	if ( ! call_user_func( $notice['condition'] ) ) {
		return;
	}

	include __DIR__ . '/views/notice.php';
}

/**
 * Prints script for handling notice dismissal and persistence.
 *
 * @param string $data The data to print.
 */
function action_admin_footer() : void {
	printf( "
		<script>
			document.querySelectorAll( '.altis-notice__dismiss' ).forEach( function ( button ) {
				button.addEventListener( 'click', function ( event ) {
					var notice = button.parentNode.parentNode;
					notice.className = notice.className + ' hidden';
					notice.style.display = 'none';
					setUserSetting( notice.id.replace( '-notice-', '-notice-dismissed-' ), 'true' );
				} );
			} );
		</script>
	" );
}
