import { __, sprintf } from '@wordpress/i18n';

import { ABTest } from '../../../../global';
import { getLetter, getLift, compactMetric } from '../../../../utils';

import { CardTitle, Body, Caption } from '@/components/ui/typography';

interface ABTestResultProps {
	test: ABTest,
}

const TrophyIcon = () => (
	<svg
		className="shrink-0"
		fill="none"
		height="20"
		stroke="currentColor"
		strokeLinecap="round"
		strokeLinejoin="round"
		strokeWidth="2"
		viewBox="0 0 24 24"
		width="20"
	>
		<path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
		<path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
		<path d="M4 22h16" />
		<path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
		<path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
		<path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
	</svg>
);

const ShrugIcon = () => (
	<svg
		className="shrink-0"
		fill="none"
		height="20"
		stroke="currentColor"
		strokeLinecap="round"
		strokeLinejoin="round"
		strokeWidth="2"
		viewBox="0 0 24 24"
		width="20"
	>
		<circle cx="12" cy="12" r="10" />
		<line x1="8" x2="8" y1="15" y2="15" />
		<line x1="16" x2="16" y1="15" y2="15" />
		<path d="M9 9h.01" />
		<path d="M15 9h.01" />
	</svg>
);

const ABTestResult = ( { test }: ABTestResultProps ) => {

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
		<div className="mx-2.5 mt-2.5 mb-1 rounded-lg border border-brand/20 bg-brand/10 p-3">
			{ winningVariantId === 0 && winningVariantData && (
				<div className="flex flex-col gap-1.5">
					<div className="flex items-center gap-2 text-brand">
						<TrophyIcon />
						<CardTitle>{ __( 'Variant A is the winner!', 'altis' ) }</CardTitle>
					</div>
					<Body>{ sprintf(
						__( 'Conversion rate: %s, the original version is the best.', 'altis' ),
						compactMetric( winningVariantData.rate * 100, '%' )
					) }</Body>
					<Caption>{ __( 'The winning variant will be shown to everyone, you can also convert the block to a standard Synced Pattern using the winning variant using the sidebar controls.' ) }</Caption>
				</div>
			) }
			{ winningVariantId !== null && winningVariantId !== 0 && winningVariantData && (
				<div className="flex flex-col gap-1.5">
					<div className="flex items-center gap-2 text-brand">
						<TrophyIcon />
						<CardTitle>{ sprintf(
							__( 'Variant %s is the winner!', 'altis' ),
							getLetter( winningVariantId )
						) }</CardTitle>
					</div>
					<Body>{ sprintf(
						__( 'The conversion rate was %s, %s higher than the original.', 'altis' ),
						compactMetric( winningVariantData.rate * 100, '%' ),
						compactMetric( getLift( winningVariantData.rate, baseVariantData.rate ), '%' )
					) }</Body>
					<Caption>{ __( 'The winning variant will be shown to everyone, you can also convert the block to a standard Synced Pattern using the winning variant using the sidebar controls.' ) }</Caption>
				</div>
			) }
			{ winningVariantId === null && (
				<div className="flex flex-col gap-1.5">
					<div className="flex items-center gap-2 text-muted-foreground">
						<ShrugIcon />
						<CardTitle>{ __( 'There was no clear winner', 'altis' ) }</CardTitle>
					</div>
					<Body>{ __( 'There was no statistically significant improvement in the conversion rate between the variants.', 'altis' ) }</Body>
					<Caption>{ __( 'You can downgrade to a regular Synced Pattern using the sidebar controls or make some edits and save the block to try the test again.', 'altis' ) }</Caption>
				</div>
			) }
		</div>
	);
};

export default ABTestResult;
