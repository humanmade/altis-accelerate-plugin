import React from 'react';

import Dashboard from '../content-explorer/Dashboard';
import BroadcastManager from '../broadcast-manager';
import { InitialData } from '../../utils/admin';

interface State {
	user: InitialData['user'],
}

interface Props {
	config: Window['AltisAccelerateDashboardData'],
}

export default class App extends React.Component<Props, State> {
	state: State = {
		user: {
			name: '...',
		},
	};

	constructor( props: Props ) {
		super( props );

		this.state.user = props.config.user;
	}

	render() {
		return (
			<main className="altis-ui App">
				{ this.props.config.screen === 'accelerate' && (
					<Dashboard
						postTypes={ this.props.config.post_types }
						showWelcome={ this.props.config.location === 'dashboard' }
						user={ this.state.user }
					/>
				) }
				{ this.props.config.screen === 'broadcast' && (
					<BroadcastManager
						id={ this.props.config.id ?? 0 }
						postTypes={ this.props.config.post_types }
						user={ this.state.user }
					/>
				) }
			</main>
		);
	}
}
