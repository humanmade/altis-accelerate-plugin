import React from 'react';

import {
	Button,
	RangeControl,
	ToggleControl,
} from '@wordpress/components';
import { useDispatch, useSelect } from '@wordpress/data';
import { __ } from '@wordpress/i18n';
import Title from '../../variant/components/Title';

export function AdvancedControls( props ) {
	const {
		block, // The global block instance if embedded in other editor.
		wrapper,
	} = props;

	const blocks = useSelect( select => select( 'core/block-editor' ).getBlocks( block?.clientId || '' ) );
	const variants = blocks.filter( b => b.name === 'altis/variant' );
	const { editEntityRecord } = useDispatch( 'core' );
	const { replaceBlocks } = useDispatch( 'core/block-editor' );

	// As we update the blockPost object we need to make we get updates when the block post is updated. We can't rely on
	// props.blockPost being updated when calling `editEntityRecord( 'postType', 'wp_block', blockPost.id` as that requires
	// the parent is correctly subscribed to updates. This isn't the case in the <PluginSidebar /> from Accelerate when
	// editing a global block. That's because the `blockPost` is pulled from `select( 'core/editor' ).getCurrentPost()`
	// which doesn't trigger an update when calling `editEntityRecord( 'postType', 'wp_block', blockPost.id`.
	const blockPost = useSelect( select => {
		return select( 'core' ).getEditedEntityRecord( 'postType', 'wp_block', props.blockPost.id );
	}, [ props.blockPost.id ] );
	const panels = [];

	if ( blockPost.blockType === 'abtest' ) {
		panels.push( {
			title: __( 'Advanced Controls', 'altis' ),
			children: (
				<>
					{ blockPost?.ab_tests?.block && (
						<ToggleControl
							checked={ blockPost?.ab_tests?.block?.paused }
							help={
								blockPost?.ab_tests?.block?.paused
									? 'Test paused.'
									: 'Test is running. Edits will restart the test.'
							}
							label={ __( 'Pause A/B Test' ) }
							onChange={ () => {
								editEntityRecord( 'postType', 'wp_block', blockPost.id, {
									ab_tests: {
										...( blockPost?.ab_tests || {} ),
										block: { ...( blockPost?.ab_tests?.block || {} ), paused: ! blockPost?.ab_tests?.block?.paused }
									},
								} );
							} }
						/>
					) }
					<RangeControl
						help={ __( 'How much of your total traffic to test. Those excluded will see Variant A and not factor into conversion rates.', 'altis' ) }
						label={ __( 'Traffic Percentage', 'altis' ) }
						max={ 100 }
						min={ 0 }
						step={ 5 }
						value={ blockPost?.ab_tests?.block?.traffic_percentage || 100 }
						onChange={ newPercentage => {
							editEntityRecord( 'postType', 'wp_block', blockPost.id, {
								ab_tests: {
									...( blockPost?.ab_tests || {} ),
									block: { ...( blockPost?.ab_tests?.block || {} ), traffic_percentage: newPercentage }
								},
							} );
						} }
					/>
				</>
			),
		} )
	}

	if ( ( blockPost.blockType || 'standard' ) !== 'standard' ) {
		panels.push( {
			title: __( 'Downgrade Block', 'altis' ),
			children: (
				<>
					<p>{ __( 'Convert to standard Synced Pattern using', 'altis' ) }:</p>
					{ variants.map( ( variant, index ) => {
						return (
							<p key={ variant.clientId }>
								<Button
									isSecondary
									onClick={ () => {
										// eslint-disable-next-line no-alert
										if ( ! window.confirm( __( 'Are you sure you want to convert back to a standard block?', 'altis' ) ) ) {
											return;
										}
										editEntityRecord( 'postType', 'wp_block', blockPost.id, { blockType: 'standard' } );
										replaceBlocks( variants.map( v => v.clientId ), variant.innerBlocks );
									} }
								>
									<Title
										index={ index }
										type={ blockPost.blockType || 'standard' }
										variant={ variant.attributes }
									/>
								</Button>
							</p>
						);
					} ) }
				</>
			)
		} );
	}

	return panels.map( wrapper );
}
