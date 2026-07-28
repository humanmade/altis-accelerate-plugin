import React from 'react';

import { usePersistentState } from '../../data/hooks';
import { useFullscreenMode } from '../../lib/hooks';
import { InitialData } from '../../utils/admin';

import AnalyticsView from './AnalyticsView';
import ConnectionSuccessDialog from './ConnectionSuccessDialog';
import OnboardingBar from './OnboardingBar';
import Welcome from './Welcome';

const isConnected = new URLSearchParams( window.location.search ).get( 'connected' ) === '1';

interface Props {
	user: InitialData['user'],
	showWelcome: boolean,
	onboarding?: InitialData['onboarding'],
}

export default function Dashboard( props: Props ) {
	const [ checklistDismissed, setChecklistDismissed ] = usePersistentState<boolean>( 'onboarding-checklist-dismissed', false );
	const [ isFullscreen, toggleFullscreen ] = useFullscreenMode();

	const showChecklist = !! props.onboarding && ! checklistDismissed && ! isFullscreen;

	return (
		<div className="Dashboard">
			{ isConnected && <ConnectionSuccessDialog /> }
			{ props.showWelcome ? (
				<Welcome user={ props.user } />
			) : null }
			{ showChecklist && props.onboarding && (
				<OnboardingBar
					onboarding={ props.onboarding }
					userName={ props.user.name }
					onDismiss={ () => setChecklistDismissed( true ) }
				/>
			) }
			<AnalyticsView
				isFullscreen={ isFullscreen }
				periodPersistKey="Content Explorer-period"
				onToggleFullscreen={ toggleFullscreen }
			/>
		</div>
	);
}
