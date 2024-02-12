<style>.altis-ui{visibility: hidden;opacity:0;}</style>
<div class="altis-ui altis-notice <?php echo $notice['dismissable'] ? 'is-dismissible' : '' ?>" id="altis-notice-<?php echo esc_attr( $notice_id ); ?>">
	<?php if ( $notice['dismissable'] ) : ?>
		<div class="altis-notice__top">
			<?php esc_html_e( 'Notification', 'altis' ); ?>
			<button type="button" class="altis-notice__dismiss">
				<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" height="20" width="20">
					<path stroke-linecap="round" stroke-linejoin="round" d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
				</svg>
				<span class="screen-reader-text"><?php esc_html_e( 'Dismiss this notice', 'altis' ); ?></span>
			</button>
		</div>
	<?php endif; ?>
	<div class="altis-notice__content">
		<div class="altis-notice__col">
			<?php if ( $notice['heading'] ) : ?>
				<h1 class="altis-notice__heading"><?php echo esc_html( $notice['heading'] ); ?></h1>
			<?php endif; ?>
			<?php if ( $notice['subheading'] ) : ?>
				<h2 class="altis-notice__subheading"><?php echo esc_html( $notice['subheading'] ); ?></h2>
			<?php endif; ?>
			<?php if ( $notice['body'] ) : ?>
				<div class="altis-notice__body"><?php echo wp_kses_post( $notice['body'] ); ?></div>
			<?php endif; ?>
			<?php if ( $notice['cta'] ) : ?>
				<div class="altis-notice__cta">
					<a class="components-button is-secondary" href="<?php echo esc_attr( $notice['cta']['link'] ); ?>">
						<?php echo esc_html( $notice['cta']['label'] ); ?>
					</a>
				</div>
			<?php endif; ?>
		</div>
		<div class="altis-notice__col">
			<?php if ( $notice['image'] ) : ?>
				<img class="altis-notice__image algnright" src="<?php echo esc_attr( $notice['image'] ); ?>" />
			<?php endif; ?>
		</div>
	</div>
</div>
