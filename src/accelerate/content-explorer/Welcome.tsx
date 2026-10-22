import { __ } from '@wordpress/i18n';

import { InitialData, trackEvent } from '../../utils/admin';

interface Props {
	user: InitialData['user'],
}

export default function Welcome( _props: Props ) {
	return (
		<div className="WelcomeIntro">
			<h2>
				{ __( 'Your analytics', 'altis' ) }
			</h2>
			<p>
				{ __( 'This is the Accelerate dashboard', 'altis' ) }
				{ '  — ' }
				<a href='?widgets=true' onClick={ () => trackEvent( 'content_explorer_widgets_page_clicked' ) }>
					{ __( 'your standard WordPress dashboard & widgets are still available here', 'altis' ) }
				</a>
				{ ' ' }
				({ __( 'or under the menu on the left', 'altis' ) }).
			</p>
		</div>
	);
}
