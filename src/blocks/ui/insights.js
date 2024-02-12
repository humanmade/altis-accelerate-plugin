import React from 'react';
import styled from 'styled-components';

import ABTest from './insights/ab-test';
import Personalization from './insights/personalization';

const { Icon } = wp.components;
const { useSelect } = wp.data;
const { decodeEntities } = wp.htmlEntities;
const { __ } = wp.i18n;

const BlockWrapper = styled.div`
	.altis-analytics-block__title {
		font-size: 24px;
		line-height: 1;
		color: #4767df;
		margin: 10px 5%;
	}

	h2 {
		font-size: 24px;
	}

	.altis-analytics-block__title a {
		text-decoration: none;
		border-radius: 3px;
		margin-left: 4px;
		margin-top: -4px;
		border: 1px solid rgba(67, 108, 255, .4);
		width: 20px;
		height: 20px;
		display: inline-block;
		vertical-align: middle;
		padding: 0;
		color: #4767df;
	}

	.altis-analytics-block__content {
		padding: 0 5% 40px;
	}

	.altis-analytics-block-metrics {
		margin: 40px -5%;
		background-color: rgba(67, 108, 255, .05);
		padding: 20px 5%;
	}

	.altis-analytics-date-range {
		margin: 0 0 20px;
	}

	.altis-analytics-conclusion {
		margin: 0 0 40px;
		h2 {
			color: #4767df;
		}
		p {
			font-size: 1rem;
			margin: 20px 0;
		}
	}
`;

/**
 * Experience Block Analytics component.
 *
 * @param {Object} props The component props.
 * @param {string} props.clientId The block client ID.
 * @returns {React.ReactNode} The block view component.
 */
const Insights = ( {
	clientId,
} ) => {
	const block = useSelect( select => {
		return select( 'accelerate/xbs' ).getPost( clientId );
	}, [ clientId ] );

	// Ensure we have a block ID data.
	if ( ! clientId ) {
		return (
			<div className="message error">
				<p>{ __( 'Experience Block not found.' ) }</p>
			</div>
		);
	}
	if ( block && block.error ) {
		return (
			<div className="message error">
				<p>{ block.error.message }</p>
			</div>
		);
	}

	const props = {
		block,
		clientId,
	};

	let BlockType = null;

	switch ( block?.subtype ) {
		case 'altis/personalization':
			BlockType = Personalization;
			break;
		case 'altis/ab-test':
			BlockType = ABTest;
			break;
		default:
			BlockType = null;
	}

	return (
		<BlockWrapper className="altis-ui altis-analytics-block">
			<h2 className="altis-analytics-block__title">
				{ ( block && decodeEntities( block.title.rendered ) ) || __( 'Loading…', 'altis' ) }
				{ block && Number( block.parent ) > 0 && (
					<>
						{ ' ' }
						<a href={ `post.php?post=${ block.parent }&action=edit` }>
							<Icon icon="edit" />
							<span className="screen-reader-text">{ __( 'Edit block', 'altis' ) }</span>
						</a>
					</>
				) }
			</h2>
			<div className="altis-analytics-block__content">
				{ BlockType && <BlockType { ...props } /> }
			</div>
		</BlockWrapper>
	);
};

export default Insights;
