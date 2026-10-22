import { usePersistentState } from '../../data/hooks';
import { useFullscreenMode } from '../../lib/hooks';
import { InitialData } from '../../utils/admin';

import AnalyticsView from './AnalyticsView';
import OnboardingBar from './OnboardingBar';
import Welcome from './Welcome';

interface Props {
	user: InitialData['user'],
	showWelcome: boolean,
	onboarding?: InitialData['onboarding'],
}

export default function Dashboard( props: Props ) {
	const [ checklistDismissed, setChecklistDismissed ] = usePersistentState<boolean>( 'onboarding-checklist-dismissed', false );
	const [ isFullscreen, toggleFullscreen ] = useFullscreenMode();

	const showChecklist = !! props.onboarding && ! props.onboarding.connected_at && ! checklistDismissed && ! isFullscreen;

	return (
		<div className="Dashboard">
			{ props.showWelcome ? (
				<Welcome user={ props.user } />
			) : null }
			{ showChecklist && props.onboarding && (
				<OnboardingBar
					onboarding={ props.onboarding }
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
