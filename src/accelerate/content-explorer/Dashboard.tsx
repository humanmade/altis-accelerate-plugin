import React from 'react';

import { __ } from '@wordpress/i18n';

import { usePersistentState } from '../../data/hooks';
import { InitialData, Duration } from '../../utils/admin';
import List from '../components/List';

import ConnectionSuccessDialog from './ConnectionSuccessDialog';
import HeroChart from './HeroChart';
import OnboardingChecklist from './OnboardingChecklist';
import Welcome from './Welcome';

const isConnected = new URLSearchParams( window.location.search ).get( 'connected' ) === '1';

interface Props {
	postTypes: InitialData['postTypes'],
	user: InitialData['user'],
	showWelcome: boolean,
	onboarding?: InitialData['onboarding'],
}

export default function Dashboard( props: Props ) {
	const [ period, setPeriod ] = usePersistentState<Duration>( 'Content Explorer-period', 'P7D' );
	const [ checklistDismissed, setChecklistDismissed ] = usePersistentState<boolean>( 'onboarding-checklist-dismissed', false );

	const showChecklist = !! props.onboarding && ! checklistDismissed;

	return (
		<div className="Dashboard">
			{ isConnected && <ConnectionSuccessDialog /> }
			{ props.showWelcome ? (
				<Welcome user={ props.user } />
			) : null }
			{ showChecklist ? (
				<div className="Dashboard__hero-row">
					<div className="Dashboard__hero-row__checklist">
						<OnboardingChecklist
							onboarding={ props.onboarding }
							userName={ props.user.name }
							onDismiss={ () => setChecklistDismissed( true ) }
						/>
					</div>
					<div className="Dashboard__hero-row__chart">
						<HeroChart period={ period } />
					</div>
				</div>
			) : (
				<HeroChart period={ period } />
			) }
			<List
				currentUser={ props.user }
				filters={ [ 'all', 'blocks', 'mine' ] }
				listId="Content Explorer"
				period={ period }
				postTypes={ props.postTypes }
				searchPlaceholder={ __( 'Search Pages, Posts & Blocks', 'altis' ) }
				onSetPeriod={ setPeriod }
			/>
		</div>
	);
}
