import {
	Button,
	RangeControl,
	SelectControl,
	ToggleControl,
} from '@wordpress/components';
import { useDispatch, useRegistry, useSelect } from '@wordpress/data';
import { blockMeta, keyboardReturn, percent } from '@wordpress/icons';
import { __ } from '@wordpress/i18n';
import Title from '../../variant/components/Title';

export function AdvancedControls( props ) {
	const {
		block, // The global block instance if embedded in other editor.
		wrapper,
	} = props;

	const registry = useRegistry();
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
	const updateBlockPost = (edits) => {
		editEntityRecord('postType', 'wp_block', blockPost.id, edits, {
			undoIgnore: false,
		});
	};

	const panels = [];

	panels.push({
		title: __( 'Conversion Goal', 'altis' ),
		icon: percent,
		children: (
			<>
				<SelectControl
					__nextHasNoMarginBottom
					options={ Object.values( window.Altis.Analytics.Experiments.Goals ).map( goalConfig => {
						return {
							label: goalConfig.label,
							value: goalConfig.name,
						};
					} ) }
					value={ blockPost?.goal || 'engagement' }
					onChange={ newGoal => updateBlockPost( { goal: newGoal } ) }
				/>
				<p style={{ fontSize: '12px', color: '#666', marginTop: '8px' }}>
					<strong>{ __( 'Engagement', 'altis' ) }:</strong> { __( 'Counts any click on a link or button, or a form submission.', 'altis' ) }<br/>
					<strong>{ __( 'Link Click', 'altis' ) }:</strong> { __( 'Counts only clicks on HTML links.', 'altis' ) }<br/>
					<strong>{ __( 'Form Submission', 'altis' ) }:</strong> { __( 'Counts only form submissions.', 'altis' ) }
				</p>
			</>
		)
	});

	if ( blockPost.blockType === 'abtest' ) {
		panels.push( {
			title: __( 'A/B Test Controls', 'altis' ),
			initialOpen: true,
			icon: blockMeta,
			children: (
				<>
					<p>
						{__('Test was started', 'altis')}
						{' '}
						<strong>
							{ (() => {
								const start = new Date(blockPost?.ab_tests?.block?.start_time);
								const now = new Date();
								const diffMs = now - start;
								const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
								const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
								const relative = rtf.format(-diffDays, 'day');
								return (
									<abbr title={start.toISOString()}>
										{relative}
									</abbr>
								);
							})() }
						</strong>
					</p>
					<p>{__( 'A/B tests are restarted each time any of the block variants are edited.', 'altis' )}</p>
					<hr />
					<ToggleControl
						checked={ blockPost?.ab_tests?.block?.paused }
						help={
							blockPost?.ab_tests?.block?.paused
								? 'Test paused.'
								: 'Test is running. Edits will restart the test.'
						}
						label={ __( 'Pause A/B Test' ) }
						onChange={ () => {
							updateBlockPost( {
								ab_tests: {
									...( blockPost?.ab_tests || {} ),
									block: { ...( blockPost?.ab_tests?.block || {} ), paused: ! blockPost?.ab_tests?.block?.paused }
								},
							} );
						} }
					/>
					<hr />
					<RangeControl
						help={ __( 'How much of your total traffic to test. Those excluded will see Variant A and not factor into conversion rates.', 'altis' ) }
						label={ __( 'Traffic Percentage', 'altis' ) }
						max={ 100 }
						min={ 0 }
						step={ 5 }
						value={ blockPost?.ab_tests?.block?.traffic_percentage || 100 }
						onChange={ newPercentage => {
							updateBlockPost( {
								ab_tests: {
									...( blockPost?.ab_tests || {} ),
									block: { ...( blockPost?.ab_tests?.block || {} ), traffic_percentage: newPercentage }
								},
							} );
						} }
					/>
				</>
			),
		} );
	}

	if ( ( blockPost.blockType || 'standard' ) !== 'standard' ) {
		panels.push( {
			title: __( 'Downgrade Block', 'altis' ),
			icon: keyboardReturn,
			children: (
				<>
					<p>{ __( 'Convert to standard Synced Pattern using (the test will be removed)', 'altis' ) }:</p>
					{ variants.map( ( variant, index ) => {
						return (
							<p key={ variant.clientId }>
								<Button
									variant="secondary"
									onClick={ () => {
										// eslint-disable-next-line no-alert
										if ( ! window.confirm( __( 'Are you sure you want to convert this block back to a regular WordPress Pattern?', 'altis' ) ) ) {
											return;
										}
										registry.batch(() => {
											updateBlockPost( { blockType: 'standard' } );
											replaceBlocks( variants.map( v => v.clientId ), variant.innerBlocks );
										});
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
