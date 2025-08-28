import { __, _n, sprintf } from '@wordpress/i18n';
import { getLetter, getLift, compactMetric } from '../../../../utils';
import { ABTest } from '../../../../global';

interface ABTestResultProps {
	test: ABTest,
}

const ABTestResult = ({ test }: ABTestResultProps) => {

	// Check test has started.
	if ( ! test.start_time ) {
		return null;
	}

	// Check end status of test.
	const hasEnded = ( test.end_time && test.end_time <= Date.now() ) || Number.isInteger( test?.results?.winner );

	if ( ! hasEnded ) {
		return null;
	}

	const winningVariantId = test?.results?.winner;
	const winningVariantData = ( winningVariantId !== null && test?.results?.variants && test.results.variants[ winningVariantId || 0 ] ) || false;
	const baseVariantData = test?.results?.variants && test.results.variants[ 0 ] || false;

	return (
		<div className="altis-gb-dropdown-abtest-result">
			<div className="altis-gb-dropdown-text">
				{ winningVariantId === 0 && winningVariantData && (
					<>
						<p><strong>{ __( 'Variant A is the winner!', 'altis' ) } 🏆</strong></p>
						<p>{ sprintf(
							__( 'Conversion rate: %s, the original version is the best.', 'altis' ),
							compactMetric( winningVariantData.rate * 100, '%' )
						) }</p>
						<p>{ __( 'The winning variant will be shown to everyone, you can also convert the block to a standard Synced Pattern using the winning variant using the sidebar controls.' ) }</p>
					</>
				) }
				{ winningVariantId !== null && winningVariantId !== 0 && winningVariantData && (
					<>
						<p><strong>{ sprintf(
							__( 'Variant %s is the winner!', 'altis' ),
							getLetter( winningVariantId )
						) } 🏆</strong></p>
						<p>{ sprintf(
							__( 'The conversion rate was %s, %s higher than the original.', 'altis' ),
							compactMetric( winningVariantData.rate * 100, '%' ),
							compactMetric( getLift( winningVariantData.rate, baseVariantData.rate ), '%' )
						) }</p>
						<p>{ __( 'The winning variant will be shown to everyone, you can also convert the block to a standard Synced Pattern using the winning variant using the sidebar controls.' ) }</p>
					</>
				) }
				{ winningVariantId === null && (
					<>
						<p><strong>{ __( 'There was no clear winner', 'altis' ) } 🤷</strong></p>
						<p>{ __( 'There was no statistically significant improvement in the conversion rate between the variants.', 'altis' ) }</p>
						<p>{ __( 'You can downgrade to a regular Synced Pattern using the sidebar controls or make some edits and save the block to try the test again.', 'altis' ) }</p>
					</>
				) }
			</div>
		</div>
	);
};

export default ABTestResult;
