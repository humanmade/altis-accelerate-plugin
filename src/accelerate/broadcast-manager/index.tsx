import React, { useState } from 'react';
import { __ } from '@wordpress/i18n';

import List from '../components/List';
import { InitialData, Duration, Post } from '../../utils/admin';
import ManageModal from './modals/Manage';
import { usePersistentState } from '../../data/hooks';

interface Props {
	postTypes: InitialData['postTypes'],
	user: InitialData[ 'user' ],
	id?: number,
}

export default function Broadcasts( props: Props ) {
	const [ period, setPeriod ] = usePersistentState<Duration>( "Broadcast Manager-period", 'P7D' );
	const postTypes = props.postTypes.filter( type => type.name = 'broadcast' );
	const [ broadcastId, setBroadcastId ] = useState<number | null>( props?.id || null );
	const [ managingItem, setManagingItem ] = useState<Post | null | 'new'>( null );
	const [ refresh, setRefresh ] = useState<number>( 0 );

	const actions = {
		[ __( 'Edit Broadcast', 'altis' ) ]: ( post: Post ) => {
			setManagingItem( post );
		},
	};

	const filters = [ 'all', 'mine' ];

	return (
		<div className="Dashboard">
			<List
				actions={ actions }
				currentUser={ props.user }
				filters={ filters }
				listId="Broadcast Manager"
				period={ period }
				postId={ broadcastId }
				postType={ postTypes[0] }
				postTypes={ postTypes }
				refresh={ refresh }
				searchPlaceholder={ __( 'Search Broadcasts', 'altis' ) }
				onAddNewItem={ () => setManagingItem( 'new' ) }
				onManageItem={ setManagingItem }
				onSetPeriod={ setPeriod }
				onSetPostId={ setBroadcastId }
			/>
			{ ( managingItem ) && (
				<ManageModal
					item={ managingItem }
					listId="Broadcast Manager"
					onClose={ () => {
						setManagingItem( null );
					} }
					onSuccess={ item => {
						setManagingItem( item );
						setBroadcastId( item.id );
						setRefresh( refresh + 1 );
					} }
				/>
			) }
		</div>
	)
}
