import React, { useEffect, useState } from 'react';

import apiFetch from '@wordpress/api-fetch';
import { __ } from '@wordpress/i18n';
import { addQueryArgs } from '@wordpress/url';

import { MetricTile, DeltaTone } from '../../components/MetricTile';
import { resolveCurrentRealtimeWindow, resolvePriorPeriod } from '../../data';
import { computeDelta, Delta } from '../../lib/utils';
import { Duration, StatsResult } from '../../utils/admin';

import './Summary.css';

const numberFormat = new Intl.NumberFormat();

const formatNumber = ( value: number ) => {
	if ( value < 1000 ) {
		return numberFormat.format( value );
	}
	if ( value < 1_000_000 ) {
		return `${ ( value / 1000 ).toFixed( value < 10_000 ? 1 : 0 ) }k`;
	}
	return `${ ( value / 1_000_000 ).toFixed( 1 ) }M`;
};

const formatPercent = ( value: number ) => `${ Math.round( value ) }%`;

const formatRatio = ( value: number ) => value.toFixed( 1 );

type PriorSummary = {
	visitors: number;
	views: number;
	bounce: number;
} | null;

// Fetches the prior-equivalent (or realtime current 15-min) summary so
// the strip can render delta arrows alongside each metric. Mirrors the
// pattern in HeroChart — see src/components/CLAUDE.md.
function useStripDeltas( period: Duration, realtimeTick: number ) {
	const [ prior, setPrior ] = useState<PriorSummary>( null );
	const [ realtimeCurrent, setRealtimeCurrent ] = useState<PriorSummary>( null );
	const isRealtime = period === 'PT30M';
	const lastPriorPeriodRef = React.useRef<Duration | null>( null );

	useEffect( () => {
		const win = resolvePriorPeriod( period );
		if ( ! win ) {
			setPrior( null );
			lastPriorPeriodRef.current = null;
			return;
		}
		let cancelled = false;
		// Only blank the prior on a period change, not on tick — keeps delta
		// arrows visible while the new summary is in-flight.
		if ( lastPriorPeriodRef.current !== period ) {
			setPrior( null );
			lastPriorPeriodRef.current = period;
		}
		apiFetch<StatsResult>( {
			path: addQueryArgs( '/accelerate/v1/stats', {
				start: win.start.toISOString(),
				end: win.end.toISOString(),
				interval: win.interval,
				tz: win.tz,
			} ),
		} ).then(
			value => {
				if ( cancelled ) {
					return;
				}
				const s = value?.stats?.summary;
				setPrior( {
					visitors: s?.visitors ?? 0,
					views: s?.views ?? 0,
					bounce: s?.bounce ?? 0,
				} );
			},
			() => {
				if ( ! cancelled ) setPrior( null );
			}
		);
		return () => {
			cancelled = true;
		};
	}, [ period, realtimeTick ] );

	useEffect( () => {
		if ( ! isRealtime ) {
			setRealtimeCurrent( null );
			return;
		}
		const win = resolveCurrentRealtimeWindow();
		let cancelled = false;
		apiFetch<StatsResult>( {
			path: addQueryArgs( '/accelerate/v1/stats', {
				start: win.start.toISOString(),
				end: win.end.toISOString(),
				interval: win.interval,
				tz: win.tz,
			} ),
		} ).then(
			value => {
				if ( cancelled ) {
					return;
				}
				const s = value?.stats?.summary;
				setRealtimeCurrent( {
					visitors: s?.visitors ?? 0,
					views: s?.views ?? 0,
					bounce: s?.bounce ?? 0,
				} );
			},
			() => {
				if ( ! cancelled ) setRealtimeCurrent( null );
			}
		);
		return () => {
			cancelled = true;
		};
	}, [ isRealtime, realtimeTick ] );

	return {
		prior,
		realtimeCurrent,
	};
}

function toneFor( higherIsBetter: boolean, delta?: Delta ): DeltaTone {
	if ( ! delta || ! delta.hasData || delta.direction === 0 ) {
		return 'neutral';
	}
	const good = higherIsBetter ? delta.direction === 1 : delta.direction === -1;
	return good ? 'positive' : 'negative';
}

interface Props {
	data?: StatsResult;
	period?: Duration;
	realtimeTick?: number;
}

export default function Summary( { data, period = 'P7D', realtimeTick = 0 }: Props ) {
	const { prior, realtimeCurrent } = useStripDeltas( period, realtimeTick );

	if ( ! data ) {
		return null;
	}

	const baseSummary = data.stats.summary;
	const isRealtime = period === 'PT30M';
	const visitors = isRealtime ? ( realtimeCurrent?.visitors ?? 0 ) : ( baseSummary.visitors || 0 );
	const views = isRealtime ? ( realtimeCurrent?.views ?? 0 ) : ( baseSummary.views || 0 );
	const bounce = isRealtime ? ( realtimeCurrent?.bounce ?? 0 ) : ( baseSummary.bounce || 0 );
	const viewsPerUnique = visitors > 0 ? views / visitors : 0;
	const bouncePct = visitors > 0 ? ( bounce / visitors ) * 100 : 0;

	const priorVisitors = prior?.visitors ?? 0;
	const priorViews = prior?.views ?? 0;
	const priorViewsPerUnique = priorVisitors > 0 ? priorViews / priorVisitors : 0;
	const priorBouncePct = priorVisitors > 0 ? ( ( prior?.bounce ?? 0 ) / priorVisitors ) * 100 : 0;

	const viewsDelta = prior ? computeDelta( views, priorViews ) : undefined;
	const visitorsDelta = prior ? computeDelta( visitors, priorVisitors ) : undefined;
	const ppvDelta = prior ? computeDelta(
		Math.round( viewsPerUnique * 10 ),
		Math.round( priorViewsPerUnique * 10 )
	) : undefined;
	const bounceDelta = prior ? computeDelta(
		Math.round( bouncePct ),
		Math.round( priorBouncePct )
	) : undefined;

	return (
		<div className="grid gap-4 grid-cols-2 xl:grid-cols-4">
			<MetricTile
				delta={ viewsDelta }
				deltaTone={ toneFor( true, viewsDelta ) }
				label={ __( 'Page views', 'altis' ) }
				value={ formatNumber( views ) }
			/>
			<MetricTile
				delta={ visitorsDelta }
				deltaTone={ toneFor( true, visitorsDelta ) }
				label={ __( 'Unique visitors', 'altis' ) }
				value={ formatNumber( visitors ) }
			/>
			<MetricTile
				delta={ ppvDelta }
				deltaTone={ toneFor( true, ppvDelta ) }
				hint={ __( 'Views per unique visitor', 'altis' ) }
				label={ __( 'Pages per visit', 'altis' ) }
				value={ formatRatio( viewsPerUnique ) }
			/>
			<MetricTile
				delta={ bounceDelta }
				deltaTone={ toneFor( false, bounceDelta ) }
				hint={ __( 'Visitors who only viewed one page', 'altis' ) }
				label={ __( 'Bounce rate', 'altis' ) }
				value={ formatPercent( bouncePct ) }
			/>
		</div>
	);
}
