import React from 'react';

import { __ } from '@wordpress/i18n';

import { usePersistentState } from '../../data/hooks';
import { InitialData, Duration } from '../../utils/admin';
import List from '../components/List';

interface Props {
	postTypes: InitialData['postTypes'],
	user: InitialData['user'],
}

// Dedicated Content Explorer page — the content data table that used to live
// at the bottom of the Dashboard. It owns its own period (separate persisted
// key from the Dashboard) and surfaces the List's own period filter.
export default function ContentExplorer( props: Props ) {
	const [ period, setPeriod ] = usePersistentState<Duration>( 'Content Explorer Table-period', 'P7D' );

	return (
		<div className="Dashboard tailwind">
			{ /* Top spacing so the table controls clear the page header — the
			   List's own 5px top padding assumes content sits above it (as on
			   the old combined view). pt-6 is on a descendant because Tailwind
			   utilities don't apply to the `.tailwind` element itself. */ }
			<div className="pt-6">
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
		</div>
	);
}
