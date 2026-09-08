import { Maximize2, Minimize2 } from 'lucide-react';
import * as React from 'react';

import { __ } from '@wordpress/i18n';

import { periods as PERIODS } from '../../../data/periods';
import { Duration } from '../../../utils/admin';
import { RealtimeRing } from '../../content-explorer/RealtimeRing';

import { AltisMark } from './AltisMark';

import { HelpPopover } from '@/components/HelpPopover';
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

function WrappedPeriodTabs( {
	options,
	value,
	onValueChange,
}: {
	options: { value: string; label: React.ReactNode }[];
	value: string;
	onValueChange: ( value: string ) => void;
} ) {
	return (
		<div
			aria-label={ __( 'Select period', 'altis' ) }
			className="flex max-w-full flex-wrap gap-1 rounded-lg bg-muted p-1"
			role="group"
		>
			{ options.map( option => (
				<button
					key={ option.value }
					aria-pressed={ option.value === value }
					className={ cn(
						'inline-flex h-7 items-center justify-center whitespace-nowrap rounded-md px-2 text-xs font-medium transition-colors',
						'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
						option.value === value
							? 'bg-background text-foreground shadow-sm'
							: 'text-gray-600 hover:text-foreground'
					) }
					type="button"
					onClick={ () => onValueChange( option.value ) }
				>
					{ option.label }
				</button>
			) ) }
		</div>
	);
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
					'sticky z-20 bg-muted/95 backdrop-blur-md',
					'transition-shadow duration-200 ease-out',
					stuck && 'shadow-sm border-b border-border'
				) }
				style={ { top: isFullscreen ? 0 : ADMIN_BAR_PX } }
			>
				<div className="mx-4 flex flex-wrap items-start justify-between gap-x-3 gap-y-2 py-2 lg:mx-16">
					<div className="flex min-w-0 flex-1 flex-wrap items-center gap-y-2">
						{ /* When the bar sticks, the slot first opens to make */ }
						{ /* room (200ms), then the mark fades in (200ms). No */ }
						{ /* horizontal slide — the logo just appears in place. */ }
						<div
							aria-hidden={ ! stuck }
							className={ cn(
								'block overflow-hidden max-md:hidden',
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
						<div className="basis-full md:basis-auto">
							<div className="md:hidden">
								<WrappedPeriodTabs
									options={ options }
									value={ period as string }
									onValueChange={ v => onChange( v as Duration ) }
								/>
							</div>
							<AnimatedTabs
								className="inline-flex !h-9 !rounded-none !bg-transparent !p-0 motion-reduce:transition-none max-md:hidden"
								options={ options }
								value={ period as string }
								onValueChange={ ( v: string ) => onChange( v as Duration ) }
							/>
						</div>
						{ /* Realtime is otherwise opaque about what it shows — */ }
						{ /* state the window explicitly; the draining ring on the */ }
						{ /* chip already signals the live refresh, with focusable */ }
						{ /* help for its cadence. */ }
						{ isRealtime && (
							<HelpPopover
								className="mt-2 shrink-0 whitespace-nowrap text-xs text-muted-foreground/80 md:mt-0 md:ml-3 md:border-l md:border-border/60 md:pl-3"
								help={ __( 'Showing the last 30 minutes. Auto-refreshes every 15 seconds.', 'altis' ) }
								label={ __( 'Last 30 minutes', 'altis' ) }
							/>
						) }
						{ filterSlot && (
							<div
								aria-hidden={ ! showFilterSlot }
								className={ cn(
									'overflow-hidden transition-[max-width,opacity] duration-200 ease-out motion-reduce:transition-none',
									showFilterSlot ? 'mt-2 ml-0 max-w-full opacity-100 md:mt-0 md:ml-3 md:max-w-xs' : 'ml-0 max-w-0 opacity-0 pointer-events-none'
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
						className="!h-8 !w-8 !shrink-0 !p-0 !text-muted-foreground hover:!bg-background hover:!text-foreground"
						size="sm"
						title={ isFullscreen
							? __( 'Exit fullscreen (Esc)', 'altis' )
							: __( 'Fullscreen for wall display', 'altis' ) }
						variant="ghost"
						onClick={ onToggleFullscreen }
					>
						<FullscreenIcon aria-hidden="true" className="h-4 w-4" />
					</Button>
				</div>
			</div>
		</>
	);
}
