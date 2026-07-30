<?php
/**
 * Altis Accelerate Admin UI.
 */

namespace Altis\Accelerate\Admin\Notices;

use Altis\Accelerate;

const USER_GUIDE_URL = 'https://www.accelerateplugin.com/docs/features/ab-testing/';
const USER_GUIDE_BROADCAST_URL = 'https://www.accelerateplugin.com/docs/features/broadcast/';

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
			'heading' => __( 'Welcome to Accelerate (Beta)', 'altis' ),
			'subheading' => '',
			'body' => '<p>'
				. __( 'You\'ve just unlocked powerful new tools for the WordPress editor. Use Accelerate to get better results from your content.', 'altis' )
				. '</p><p>'
				. __( 'Here\'s what you can do now:', 'altis' )
				. '</p>'
				. '<ul><li>'
				. __( '<strong>Broadcast</strong>: Instantly push block updates across your entire site from one place.', 'altis' )
				. '</li><li>'
				. __( '<strong>A/B Test</strong>: Experiment with blocks, titles, and images to see what converts best.', 'altis' )
				. '</li><li>'
				. __( '<strong>Personalize</strong>: Show different content to different audiences automatically.', 'altis' )
				. '</li></ul><p>'
				. sprintf(
					__( 'Your next step: Read the <a href="%s" target="_accelerate">Quick Start Guide</a> to launch your first test in minutes.', 'altis' ),
					USER_GUIDE_URL
				),
			'image' => plugins_url( 'assets/hiking.png', Accelerate\PLUGIN_FILE ),
			'bg_image' => 'acc-bg.jpg',
			'cta' => false,
		],
		'edit-broadcast' => [
			'dismissable' => true,
			'heading' => 'Introducing Broadcasts',
			'subheading' => '',
			'body' => '<p>'
				. __( 'Instantly promote any content across your entire website. Place a Broadcast in your content, and you can centrally manage what it displays site-wide.', 'altis' )
				. '</p><p>'
				. __( 'Use it to:', 'altis' )
				. '</p>'
				. '<ul><li>'
				. __( '<strong>Launch Site-Wide Campaigns</strong>', 'altis' )
				. '</li><li>'
				. __( '<strong>Distribute New Content:</strong> Drive large traffic immediately to new content', 'altis' )
				. '</li><li>'
				. __( '<strong>Test Ideas Rapidly:</strong> Place blocks in Broadcast for more data faster.', 'altis' )
				. '</li></ul><p>'
				. sprintf(
					__( 'This is how you scale content distribution. Get started in the <a href="%s" target="_accelerate">Broadcasts User Guide</a>.', 'altis' ),
					USER_GUIDE_BROADCAST_URL
				)
				. '</p>',
			'image' => plugins_url( 'assets/broadcasts.png', Accelerate\PLUGIN_FILE ),
			'bg_image' => 'acc-bg2.jpg',
			'cta' => false,
		],
		'accelerate_page_altis-accelerate-settings' => [
			'dismissable' => false,
			'heading' => __( 'Welcome to Accelerate', 'altis' ),
			'subheading' => __( 'Unlock marketing within WordPress', 'altis' ),
			'body' => '<p>' . __( 'If you already have an account you can login via the button below. If you don\'t, creating an account takes just a few moments.', 'altis' ) . '</p>',
			'image' => plugins_url( 'assets/hiking.png', Accelerate\PLUGIN_FILE ),
			'bg_image' => 'acc-bg3.jpg',
			'cta' => [
				'label' => __( 'Create your account now', 'altis' ),
				'link' => Accelerate\get_accelerate_dashboard_authorize_url(),
			],
			'condition' => function () {
				return empty( Accelerate\get_accelerate_dashboard_access_token() );
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
		'bg_image' => '',
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
