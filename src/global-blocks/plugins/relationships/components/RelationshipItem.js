import PropTypes from 'prop-types';

import { PanelRow } from '@wordpress/components';
import { __, sprintf } from '@wordpress/i18n';

import settings from '../../../settings';

const { editPostUrl } = settings;

const RelationshipItem = ( { id, status, title } ) => {
	const itemTitle = title.rendered || __( '(No Title)', 'altis' );

	return (
		<PanelRow key={ id }>
			<a href={ sprintf( editPostUrl, id ) } rel="noopener noreferrer" target="_blank">
				{ `#${ id } - ${ itemTitle }` }
			</a>
			{ status === 'draft' && __( '(Draft)', 'altis' ) }
			{ status === 'pending' && __( '(Pending)', 'altis' ) }
		</PanelRow>
	);
};

RelationshipItem.propTypes = {
	id: PropTypes.number.isRequired,
	status: PropTypes.string.isRequired,
	title: PropTypes.shape( {
		rendered: PropTypes.string.isRequired,
	} ),
};

export default RelationshipItem;
