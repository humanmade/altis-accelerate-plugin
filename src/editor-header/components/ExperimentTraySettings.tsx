import React, { Fragment, useEffect } from 'react';

import Duration from '../../experiments/components/duration';
import withTestData from '../../experiments/data/with-test-data';
import { arrayEquals, compactMetric, getLetter, getLift, removeElement, replaceElement } from '../../utils';
import { getP2BB, trackEvent } from '../../utils/admin';

import { DateTimePicker } from './DateTimePicker';

import { Button } from '@/components/ui/button';
import { Caption } from '@/components/ui/typography';

const { Icon } = wp.components;
const { __ } = wp.i18n;

const TraySettings = ( props: any ) => {
	const {
		abTest,
		isSaving,
		originalValues,
		post,
		prevValues,
		defaultValue,
		values,
		test,
		setState,
		updateTest,
		updateValues,
	} = props;
	const {
		paused,
		started,
		start_time: startTime,
		end_time: endTime,
		traffic_percentage: trafficPercentage,
		results,
	} = test;
	const {
		variants = [],
	} = results;

	const { component: Component } = abTest;
	const baseRate = ( variants && variants[ 0 ] ) ? variants[ 0 ].rate * 100 : 0;

	useEffect( () => {
		if ( originalValues.length && ! prevValues.length ) {
			setState( { prevValues: originalValues } );
		}
	}, [ originalValues, prevValues, setState ] );

	const setPaused = ( state: boolean ) => {
		setState( { prevValues: values } );
		updateTest( { state }, values, true );
	};

	const startTest = ( vals: any[] ) => {
		setState( { prevValues: vals } );
		updateTest( {
			started: true,
			paused: false,
		}, vals, true );
	};

	const resetValues = () => {
		updateValues( prevValues );
	};

	const isActive = started && startTime <= Date.now() && endTime >= Date.now();
	const allValues = values.length > 0 ? values : [ defaultValue ];
	const traffic = trafficPercentage || 35;
	const startDate = new Date( startTime || Date.now() );
	const endDate = new Date( endTime || Date.now() + ( 30 * 24 * 60 * 60 * 1000 ) );
	const isRunning = ! paused && started;

	return (
		<>
			{ /* Variant table */ }
			<table className="w-full table-auto">
				<thead className="text-left text-gray-400 text-xs">
					<tr>
						<th className="pb-1 pr-2">{ __( 'Variant', 'altis' ) }</th>
						<th className="pb-1 pr-2">{ abTest.singleTitle }</th>
						<th className="pb-1 pr-2 w-[60px]">{ __( 'Views', 'altis' ) }</th>
						{ isRunning && (
							<>
								<th className="pb-1 pr-2">{ __( 'Conversion Rate', 'altis' ) }</th>
								<th className="pb-1 pr-2">{ __( 'Improvement', 'altis' ) }</th>
								<th className="pb-1 pr-2">{ __( 'Probability to be Best', 'altis' ) }</th>
							</>
						) }
						{ isRunning && (
							<th className="pb-1 pr-2 w-[60px]">{ __( 'Preview', 'altis' ) }</th>
						) }
						{ paused && (
							<th className="pb-1 w-[40px]" />
						) }
					</tr>
				</thead>
				<tbody className="border" style={ { borderColor: '#ddd' } }>
					{ allValues.map( ( value: any, index: number ) => {
						const variant = ( variants && variants[ index ] ) || { size: 0 };
						return (
							<tr
								key={ index }
								className={ `transition-all duration-300 bg-white ${ index > 0 ? 'border-t' : '' }` }
								style={ index > 0 ? { borderTopColor: '#ddd' } : {} }
							>
								<td className="px-3 py-3 !text-sm !font-semibold text-foreground whitespace-nowrap align-middle w-[120px]">
									{ `${ __( 'Variant', 'altis' ) } ${ getLetter( index ) }` }
									{ index === 0 ? ` ${ __( '(original)', 'altis' ) }` : '' }
								</td>
								<td className="px-3 py-3 align-middle">
									<Component
										allValues={ allValues }
										compact
										index={ index }
										isEditable={ paused }
										label={ null }
										value={ value }
										onChange={ ( v: any ) => updateValues( replaceElement( allValues, v, index ) ) }
										onRemove={ () => updateValues( removeElement( allValues, index ) ) }
									/>
								</td>
								<td className="px-3 py-3 !text-sm text-muted-foreground align-middle">
									{ variant.size > 0 ? variant.size.toLocaleString() : '—' }
								</td>
								{ isRunning && variant.size > 0 && (
									<>
										<td className="px-3 py-3 !text-sm text-muted-foreground align-middle">
											{ variant.rate != null ? compactMetric( variant.rate * 100, '%' ) : '—' }
										</td>
										<td className="px-3 py-3 !text-sm text-muted-foreground align-middle">
											{ index === 0
												? '—'
												: compactMetric( getLift( variant.rate * 100, baseRate ), '%' ) }
										</td>
										<td className="px-3 py-3 !text-sm text-muted-foreground align-middle">
											{ variant.p != null ? compactMetric( getP2BB( variant.p ), '%' ) : '—' }
										</td>
									</>
								) }
								{ isRunning && variant.size === 0 && (
									<td className="px-3 py-3 align-middle" colSpan={ 3 }>
										<div
											className="px-2 py-1 text-xs rounded border font-normal"
											style={ {
												color: '#6b7280',
												borderColor: '#d1d5db',
												backgroundColor: '#f9fafb',
												display: 'inline-block',
											} }
										>
											{ __( 'Collecting data...', 'altis' ) }
										</div>
									</td>
								) }
								{ isRunning && (
									<td className="px-3 py-3 align-middle">
										<a
											className="!text-sm text-brand hover:underline"
											href={ `/?p=${ post.id }&set_test=test_${ abTest.id }_${ post.id }:${ index }` }
											rel="noopener noreferrer"
											target="_ab_test_preview"
										>
											<Icon icon="external" size={ 16 } />
										</a>
									</td>
								) }
								{ paused && index > 0 && (
									<td className="px-3 py-3 align-middle">
										<Button
											className="!h-6 !w-6 !p-0"
											size="icon"
											title={ __( 'Remove', 'altis' ) }
											variant="ghost"
											onClick={ () => updateValues( removeElement( allValues, index ) ) }
										>
											<Icon icon="no-alt" size={ 16 } />
										</Button>
									</td>
								) }
								{ paused && index === 0 && (
									<td className="px-3 py-3" />
								) }
							</tr>
						);
					} ) }
					{ /* Add variant row */ }
					{ paused && allValues.length < 26 && (
						<tr
							className="transition-all duration-300 bg-white border-t"
							style={ { borderTopColor: '#ddd' } }
						>
							<td className="px-3 py-3 !text-sm !font-semibold text-foreground whitespace-nowrap align-middle">
								{ `${ __( 'Variant', 'altis' ) } ${ getLetter( allValues.length ) }` }
							</td>
							<td className="px-3 py-3" colSpan={ 3 }>
								<Component
									compact
									isEditable
									label={ null }
									suggestionPrompt={ abTest.suggestionPrompt }
									onChange={ ( value: any ) => updateValues( replaceElement( allValues, value, allValues.length ) ) }
								/>
							</td>
						</tr>
					) }
				</tbody>
			</table>

			{ /* Action bar */ }
			<div className="mt-3 flex items-center gap-4 flex-wrap">
				{ /* Status + primary action */ }
				<div className="flex items-center gap-2">
					{ paused && started && (
						<Caption>{ __( 'Test paused', 'altis' ) }</Caption>
					) }
					{ isActive && ! paused && (
						<Caption>{ __( 'Test running', 'altis' ) }</Caption>
					) }
					{ ! paused && started && startTime >= Date.now() && (
						<Caption>
							{ __( 'Starts in', 'altis' ) }{ ' ' }
							<Duration time={ startTime - Date.now() } />
						</Caption>
					) }

					{ started && (
						<Button
							disabled={ isSaving }
							size="sm"
							onClick={ () => {
								trackEvent( 'experiment_paused', {
									test: abTest.id,
									paused: ! paused,
								} );
								if ( arrayEquals( values, prevValues ) ) {
									return setPaused( ! paused );
								}
								// eslint-disable-next-line no-alert
								if ( paused && window.confirm( __( 'Resume with new variants? This will reset current results.', 'altis' ) ) ) {
									return setPaused( ! paused );
								}
								setPaused( ! paused );
							} }
						>
							{ paused ? __( 'Resume test', 'altis' ) : __( 'Pause test', 'altis' ) }
						</Button>
					) }
					{ ! started && (
						<Button
							disabled={ values.length < 2 || isSaving }
							size="sm"
							onClick={ () => {
								startTest( values );
								trackEvent( 'experiment_started', {
									test: abTest.id,
								} );
							} }
						>
							{ __( 'Start test', 'altis' ) }
						</Button>
					) }
					{ ! started && values.length < 2 && (
						<Caption>{ __( 'Add a second variant to get started.', 'altis' ) }</Caption>
					) }
				</div>

				{ /* Warnings */ }
				{ started && paused && ! arrayEquals( values, prevValues ) && (
					<div className="flex items-center gap-2">
						<Caption className="!text-destructive !italic flex items-center gap-1">
							<Icon className="shrink-0" icon="warning" size={ 14 } />
							{ __( 'Changing variants will reset results.', 'altis' ) }
						</Caption>
						<Button
							className="!p-0 !h-auto !text-xs"
							variant="link"
							onClick={ resetValues }
						>
							{ __( 'Undo', 'altis' ) }
						</Button>
					</div>
				) }

				<div className="w-px h-5 bg-border" />

				{ /* Traffic */ }
				<div className="flex items-center gap-2">
					<Caption className="whitespace-nowrap">{ __( 'Traffic', 'altis' ) }</Caption>
					<input
						className="w-20 h-1.5 accent-brand cursor-pointer"
						max={ 100 }
						min={ 0 }
						type="range"
						value={ traffic }
						onChange={ ( e: React.ChangeEvent<HTMLInputElement> ) => updateTest( { traffic_percentage: Number( e.target.value ) } ) }
					/>
					<input
						className="!w-12 !rounded-md !border !border-border !bg-background !px-1.5 !py-0.5 !text-xs text-center focus:!outline-none focus:!ring-1 focus:!ring-ring"
						max={ 100 }
						min={ 0 }
						type="number"
						value={ traffic }
						onChange={ ( e: React.ChangeEvent<HTMLInputElement> ) => updateTest( { traffic_percentage: Number( e.target.value ) } ) }
					/>
				</div>

				<div className="w-px h-5 bg-border" />

				{ /* Dates */ }
				<div className="flex items-center gap-2">
					<DateTimePicker
						value={ startTime || Date.now() }
						onChange={ ( ts: number ) => {
							updateTest( { start_time: ts < endDate.getTime() ? ts : endTime - ( 24 * 60 * 60 * 1000 ) } );
						} }
					/>
					<Caption>→</Caption>
					<DateTimePicker
						value={ endTime || Date.now() + ( 30 * 24 * 60 * 60 * 1000 ) }
						onChange={ ( ts: number ) => {
							updateTest( { end_time: ts > startDate.getTime() ? ts : startTime + ( 24 * 60 * 60 * 1000 ) } );
						} }
					/>
				</div>

				{ /* End test */ }
				{ started && (
					<Fragment>
						<div className="w-px h-5 bg-border" />
						<Button
							size="sm"
							variant="secondary"
							onClick={ () => {
								// eslint-disable-next-line no-alert
								if ( window.confirm( __( 'Are you sure you want to end the test?', 'altis' ) ) ) {
									updateTest( {
										end_time: Date.now(),
									}, false, true );
									trackEvent( 'experiment_ended', {
										test: abTest.id,
									} );
								}
							} }
						>
							{ __( 'End test', 'altis' ) }
						</Button>
					</Fragment>
				) }
			</div>
		</>
	);
};

export const ExperimentTraySettings = withTestData( TraySettings );
