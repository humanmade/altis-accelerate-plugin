import { Maximize2, Minimize2 } from 'lucide-react';
import * as React from 'react';

import { __ } from '@wordpress/i18n';

import { periods as PERIODS } from '../../../data/periods';
import { Duration } from '../../../utils/admin';
import { RealtimeRing } from '../../content-explorer/RealtimeRing';

import { AltisMark } from './AltisMark';

import { AnimatedTabs } from '@/components/ui/animated-tabs';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export const REALTIME_INTERVAL_SECONDS = 15;

// WP admin bar height. The bar is `position: fixed; top: 0; height: 32px`
// on widths >=783px.
const ADMIN_BAR_PX = 32;

interface Props {
	period: Duration;
	onChange: ( v: Duration ) => void;
	realtimeTick: number;
	isFullscreen: boolean;
	onToggleFullscreen: () => void;
	filterSlot?: React.ReactNode;
	showFilterSlot?: boolean;
}

/**
 * Full-width muted strip that pins to the top of the page (or the
 * viewport in fullscreen mode). Drops a subtle shadow when stuck.
 * Hosts the global period chips, the realtime countdown ring inside
 * the Realtime chip, and the wall-display fullscreen toggle.
 */
export function StickyPeriodBar( {
	period,
	onChange,
	realtimeTick,
	isFullscreen,
	onToggleFullscreen,
	filterSlot,
	showFilterSlot,
}: Props ) {
	const sentinelRef = React.useRef<HTMLDivElement>( null );
	const [ stuck, setStuck ] = React.useState( false );

	React.useEffect( () => {
		const sentinel = sentinelRef.current;
		if ( ! sentinel ) {
			return;
		}
		const obs = new IntersectionObserver(
			( [ entry ] ) => setStuck( entry.intersectionRatio < 1 ),
			{
				threshold: [ 1 ],
				rootMargin: `-${ ( isFullscreen ? 0 : ADMIN_BAR_PX ) + 1 }px 0px 0px 0px`,
			}
		);
		obs.observe( sentinel );
		return () => obs.disconnect();
	}, [ isFullscreen ] );

	const isRealtime = period === 'PT30M';

	const options = PERIODS.map( p => {
		if ( p.value === 'PT30M' ) {
			return {
				value: p.value,
				label: (
					<span className="inline-flex items-center gap-1.5">
						<RealtimeRing
							active={ isRealtime }
							periodSeconds={ REALTIME_INTERVAL_SECONDS }
							tick={ realtimeTick }
							title={ __( 'Live — auto-refreshes every 15 seconds', 'altis' ) }
						/>
						{ p.label }
					</span>
				),
			};
		}
		return {
			value: p.value,
			label: p.label,
		};
	} );

	const FullscreenIcon = isFullscreen ? Minimize2 : Maximize2;

	return (
		<>
			<div ref={ sentinelRef } aria-hidden="true" className="h-px" />
			<div
				className={ cn(
					'sticky z-20 bg-muted/85 backdrop-blur-sm',
					'transition-shadow duration-200 ease-out',
					stuck && 'shadow-sm'
				) }
				style={ { top: isFullscreen ? 0 : ADMIN_BAR_PX } }
			>
				<div className="mx-4 flex items-center justify-between gap-3 py-2 lg:mx-16">
					<div className="flex items-center min-w-0">
						{ /* When the bar sticks, the slot first opens to make */ }
						{ /* room (200ms), then the mark fades in (200ms). No */ }
						{ /* horizontal slide — the logo just appears in place. */ }
						<div
							aria-hidden={ ! stuck }
							className={ cn(
								'overflow-hidden',
								'transition-[width,margin] duration-200 ease-out',
								'motion-reduce:transition-none',
								stuck ? 'w-6 mr-3' : 'w-0 mr-0'
							) }
						>
							<AltisMark
								className={ cn(
									'h-6 w-6',
									'transition-opacity duration-200 ease-out',
									'motion-reduce:transition-none',
									stuck ? 'opacity-30 delay-150' : 'opacity-0'
								) }
							/>
						</div>
						<AnimatedTabs
							className="!h-9 !rounded-none !bg-transparent !p-0 motion-reduce:transition-none"
							options={ options }
							value={ period as string }
							onValueChange={ ( v: string ) => onChange( v as Duration ) }
						/>
						{ /* Realtime is otherwise opaque about what it shows — */ }
						{ /* state the window explicitly; the draining ring on the */ }
						{ /* chip already signals the live refresh, spelled out in */ }
						{ /* the tooltip. */ }
						{ isRealtime && (
							<span
								className="ml-3 shrink-0 whitespace-nowrap border-l border-border/60 pl-3 text-xs text-muted-foreground/80"
								title={ __( 'Showing the last 30 minutes. Auto-refreshes every 15 seconds.', 'altis' ) }
							>
								{ __( 'Last 30 minutes', 'altis' ) }
							</span>
						) }
						{ filterSlot && (
							<div
								aria-hidden={ ! showFilterSlot }
								className={ cn(
									'overflow-hidden transition-[max-width,opacity] duration-200 ease-out motion-reduce:transition-none',
									showFilterSlot ? 'ml-3 max-w-xs opacity-100' : 'ml-0 max-w-0 opacity-0 pointer-events-none'
								) }
							>
								{ filterSlot }
							</div>
						) }
					</div>
					<Button
						aria-label={ isFullscreen
							? __( 'Exit fullscreen', 'altis' )
							: __( 'Enter fullscreen (wall display mode)', 'altis' ) }
						className="!h-8 !w-8 !p-0 !text-muted-foreground hover:!bg-background hover:!text-foreground"
						size="sm"
						title={ isFullscreen
							? __( 'Exit fullscreen (Esc)', 'altis' )
							: __( 'Fullscreen for wall display', 'altis' ) }
						variant="ghost"
						onClick={ onToggleFullscreen }
					>
						<FullscreenIcon className="h-4 w-4" />
					</Button>
				</div>
			</div>
		</>
	);
}
