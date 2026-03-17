import React from 'react';

import withTestData from '../../experiments/data/with-test-data';
import {
	getLetter,
	getDateString,
	getDurationString,
} from '../../utils';

import { Button } from '@/components/ui/button';
import { Caption } from '@/components/ui/typography';
import { cn } from '@/lib/utils';

const { __ } = wp.i18n;

const TrayResults = ( props: any ) => {
	const {
		abTest,
		test = {},
		values = [],
		resetTest,
		revertValue,
	} = props;
	const {
		results,
		end_time: endTime,
		start_time: startTime,
		traffic_percentage: trafficPercentage,
	} = test;
	const {
		winner = null,
		variants = [],
	} = results;

	const hasEnded = endTime < Date.now();

	return (
		<>
			{ /* Results table */ }
			<table className="w-full table-auto">
				<thead className="text-left text-gray-400 text-xs">
					<tr>
						<th className="pb-1 pr-2">{ __( 'Variant', 'altis' ) }</th>
						<th className="pb-1 pr-2">{ abTest.singleTitle }</th>
						<th className="pb-1 pr-2 w-[100px]">{ __( 'Conversion', 'altis' ) }</th>
						<th className="pb-1 w-[80px]">{ __( 'Status', 'altis' ) }</th>
					</tr>
				</thead>
				<tbody className="border" style={ { borderColor: '#ddd' } }>
					{ values.map( ( value: any, index: number ) => {
						const variant = variants[ index ] || { rate: 0.0 };
						const isWinner = index === winner;

						return (
							<tr
								key={ index }
								className={ cn(
									'transition-all duration-300',
									isWinner ? 'bg-green-50' : 'bg-white',
									index > 0 && 'border-t'
								) }
								style={ index > 0 ? { borderTopColor: '#ddd' } : {} }
							>
								<td className={ cn(
									'px-3 py-3 !text-sm !font-semibold whitespace-nowrap align-middle w-[120px]',
									isWinner ? 'text-green-700' : 'text-foreground'
								) }>
									{ `${ __( 'Variant', 'altis' ) } ${ getLetter( index ) }` }
									{ index === 0 ? ` ${ __( '(original)', 'altis' ) }` : '' }
								</td>
								<td className={ cn(
									'px-3 py-3 !text-sm align-middle',
									isWinner && 'text-green-700'
								) }>
									{ abTest.displayValue( value ) }
								</td>
								<td className={ cn(
									'px-3 py-3 !text-sm align-middle',
									isWinner ? 'text-green-700' : 'text-muted-foreground'
								) }>
									{ ( variant.rate * 100 ).toFixed( 2 ) }%
								</td>
								<td className="px-3 py-3 align-middle">
									{ isWinner && (
										<span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 !text-xs !font-medium text-green-700">
											{ __( 'Winner', 'altis' ) }
										</span>
									) }
								</td>
							</tr>
						);
					} ) }
				</tbody>
			</table>

			{ /* Metadata + actions bar */ }
			<div className="mt-3 flex items-center gap-4 flex-wrap">
				{ /* Result notice */ }
				<Caption>
					{ winner !== null
						? __( 'Test complete — we have a winner!', 'altis' )
						: hasEnded
							? __( 'Test ended without a clear winner.', 'altis' )
							: '' }
				</Caption>

				<div className="w-px h-5 bg-border" />

				{ /* Metadata */ }
				<div className="flex items-center gap-3">
					<Caption>{ __( 'Traffic', 'altis' ) }: <span className="!text-foreground">{ trafficPercentage }%</span></Caption>
					<Caption>{ __( 'Started', 'altis' ) }: <span className="!text-foreground">{ getDateString( startTime ) }</span></Caption>
					<Caption>{ __( 'Ended', 'altis' ) }: <span className="!text-foreground">{ getDateString( endTime ) }</span></Caption>
					<Caption>{ __( 'Duration', 'altis' ) }: <span className="!text-foreground">{ getDurationString( endTime - startTime ) }</span></Caption>
				</div>

				<div className="w-px h-5 bg-border" />

				{ /* Actions */ }
				<div className="flex items-center gap-2">
					<Button
						size="sm"
						onClick={ () => resetTest() }
					>
						{ __( 'Run new test', 'altis' ) }
					</Button>
					{ winner !== null && winner !== 0 && (
						<Button
							className="!text-xs"
							size="sm"
							variant="link"
							onClick={ () => revertValue() }
						>
							{ __( 'Revert to original', 'altis' ) }
						</Button>
					) }
					{ winner === 0 && (
						<Caption>{ __( 'The original performed best — no changes needed.', 'altis' ) }</Caption>
					) }
				</div>
			</div>
		</>
	);
};

export const ExperimentTrayResults = withTestData( TrayResults );
