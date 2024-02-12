import React from 'react';
import { __ } from '@wordpress/i18n';

import Welcome from './Welcome';
import List from '../components/List';
import { InitialData, Duration } from '../../utils/admin';

import HeroChart from './HeroChart';
import { usePersistentState } from '../../data/hooks';

interface Props {
	postTypes: InitialData['postTypes'],
	user: InitialData['user'],
	showWelcome: boolean,
}

export default function Dashboard( props: Props ) {
	const [ period, setPeriod ] = usePersistentState<Duration>( 'Content Explorer-period', 'P7D' );

	return (
		<div className="Dashboard">
			{ props.showWelcome ? (
				<Welcome user={ props.user } />
			) : null }
			<HeroChart period={ period } />
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
	)
}
