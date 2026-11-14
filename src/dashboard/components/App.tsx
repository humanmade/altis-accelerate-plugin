import React from 'react';

import AnalyticsView from '../../accelerate/content-explorer/AnalyticsView';
import { useFullscreenMode } from '../../lib/hooks';

export default function App() {
	const [ isFullscreen, toggleFullscreen ] = useFullscreenMode();

	return (
		<main className="App">
			<AnalyticsView
				isFullscreen={ isFullscreen }
				periodPersistKey="analytics-period"
				showFilters
				onToggleFullscreen={ toggleFullscreen }
			/>
		</main>
	);
}
