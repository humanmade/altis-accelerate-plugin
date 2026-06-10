import { Globe, List } from 'lucide-react';
import * as React from 'react';

import { __ } from '@wordpress/i18n';

import { CompactSelect } from '@/components/CompactSelect';
import { MetricTile } from '@/components/MetricTile';
import { Button } from '@/components/ui/button';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Body, Caption, CardTitle, Overline, PageTitle, SectionTitle } from '@/components/ui/typography';
import { computeDelta } from '@/lib/utils';

// Internal design reference. Reachable only via direct URL — not
// linked from any navigation. Imports from src/components/ +
// src/components/ui/ ONLY; anything that needs documenting here must
// first live in those shared locations.

function Section( { title, description, children }: { title: string; description?: string; children: React.ReactNode } ) {
	return (
		<section className="mb-12">
			<SectionTitle className="!mb-1">{ title }</SectionTitle>
			{ description && <Caption className="!mb-4 !max-w-prose">{ description }</Caption> }
			<div className="rounded-lg border border-gray-200 bg-white p-6 shadow-xs">
				{ children }
			</div>
		</section>
	);
}

function Swatch( { name, varName }: { name: string; varName: string } ) {
	const ref = React.useRef<HTMLDivElement>( null );
	const [ resolved, setResolved ] = React.useState<string>( '' );
	React.useEffect( () => {
		if ( ! ref.current ) {
			return;
		}
		const cs = getComputedStyle( ref.current );
		setResolved( cs.backgroundColor );
	}, [] );
	return (
		<div className="flex items-center gap-3">
			<div
				ref={ ref }
				className={ `h-10 w-10 rounded border border-gray-200 ${ varName.startsWith( 'bg-' ) ? varName : 'bg-' + varName }` }
				style={ varName.startsWith( '--' ) ? { backgroundColor: `var(${ varName })` } : undefined }
			/>
			<div className="flex flex-col leading-tight">
				<code className="text-xs font-medium text-foreground">{ name }</code>
				<code className="text-xs text-muted-foreground">{ resolved || '…' }</code>
			</div>
		</div>
	);
}

// Inline row demo built from the canonical contract documented in
// src/components/CLAUDE.md. Two variants: static (Analytics BarList
// equivalent) and animated-on-click (BreakdownPanel equivalent).
function RowDemo() {
	const data = [
		{
			name: 'google.com',
			value: 412,
		},
		{
			name: 'twitter.com',
			value: 318,
		},
		{
			name: 'direct',
			value: 211,
		},
		{
			name: 'newsletter',
			value: 140,
		},
		{
			name: 'reddit.com',
			value: 86,
		},
	];
	const max = Math.max( ...data.map( d => d.value ) );
	const [ pulseIdx, setPulseIdx ] = React.useState<number | null>( null );
	const triggerPulse = () => {
		setPulseIdx( 0 );
		setTimeout( () => setPulseIdx( null ), 700 );
	};
	return (
		<div className="grid gap-8 md:grid-cols-2">
			<div>
				<Overline className="!mb-3 !block">Static</Overline>
				<ul className="flex flex-col space-y-1.5">
					{ data.map( d => {
						const pct = ( d.value / max ) * 100;
						return (
							<li key={ d.name } className="flex items-center gap-3">
								<div className="relative h-8 min-w-0 flex-1">
									<div className="absolute inset-y-0 left-0 rounded bg-brand/15" style={ { width: `${ pct }%` } } />
									<p className="!absolute !left-2 !top-1/2 !-translate-y-1/2 !m-0 !truncate !text-sm !text-gray-900">
										{ d.name }
									</p>
								</div>
								<p className="!m-0 !flex !h-8 !items-center !text-sm !text-gray-900 tabular-nums">{ d.value }</p>
							</li>
						);
					} ) }
				</ul>
			</div>
			<div>
				<Overline className="!mb-3 !block">With rank-pulse</Overline>
				<ul className="flex flex-col space-y-1.5">
					{ data.map( ( d, i ) => {
						const pct = ( d.value / max ) * 100;
						return (
							<li key={ d.name } className="flex items-center gap-3">
								<div className="relative h-8 min-w-0 flex-1">
									<div
										className="absolute inset-y-0 left-0 rounded bg-brand/15 transition-colors"
										style={ {
											width: `${ pct }%`,
											backgroundColor: pulseIdx === i ? 'rgba(147,50,255,0.32)' : undefined,
										} }
									/>
									<p className="!absolute !left-2 !top-1/2 !-translate-y-1/2 !m-0 !truncate !text-sm !text-gray-900">
										{ d.name }
									</p>
								</div>
								<p className="!m-0 !flex !h-8 !items-center !text-sm !text-gray-900 tabular-nums">{ d.value }</p>
							</li>
						);
					} ) }
				</ul>
				<Button className="mt-3" size="sm" variant="outline" onClick={ triggerPulse }>
					Trigger rank-up
				</Button>
			</div>
		</div>
	);
}

export default function StyleguideApp() {
	const [ toggle, setToggle ] = React.useState( 'map' );
	const [ select, setSelect ] = React.useState( 'source_campaign' );

	return (
		<div className="tailwind">
			<div className="mx-auto max-w-5xl p-8">
				<PageTitle className="!mb-1">Accelerate Styleguide</PageTitle>
				<Caption className="!mb-8 !max-w-prose">
					Internal design reference. Not linked from any navigation. Source of truth for primitives in <code>src/components/ui/</code> and compounds in <code>src/components/</code>.
				</Caption>

				<Section description="Card primitive, shadow xs, rounded-lg, border-gray-200." title="Surfaces">
					<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
						<div className="rounded-lg border border-gray-200 bg-white p-4 shadow-xs">
							<Caption className="!m-0">!p-4</Caption>
						</div>
						<div className="rounded-lg border border-gray-200 bg-white p-6 shadow-xs">
							<Caption className="!m-0">p-6 (default)</Caption>
						</div>
						<div className="rounded-lg border border-gray-200 bg-white p-8 shadow-xs">
							<Caption className="!m-0">p-8</Caption>
						</div>
					</div>
				</Section>

				<Section description="Use these instead of raw text-* classes. Each has !important baked in to survive WP admin overrides." title="Typography">
					<div className="space-y-3">
						<PageTitle>Page title (24px / 600)</PageTitle>
						<SectionTitle>Section title (18px / 600)</SectionTitle>
						<CardTitle>Card title (14px / 600)</CardTitle>
						<Body>Body text (14px / 400)</Body>
						<Caption>Caption (12px / 400 / muted)</Caption>
						<Overline>Overline (12px / 500 / uppercase tracking-wider)</Overline>
					</div>
				</Section>

				<Section description="Never hardcode hex values. Always reference these tokens." title="Color">
					<div className="grid grid-cols-2 md:grid-cols-3 gap-4">
						<Swatch name="--color-brand" varName="bg-brand" />
						<Swatch name="--color-foreground" varName="bg-foreground" />
						<Swatch name="--color-muted-foreground" varName="--color-muted-foreground" />
						<Swatch name="--color-muted" varName="bg-muted" />
						<Swatch name="--color-accent" varName="bg-accent" />
						<Swatch name="--color-destructive" varName="bg-destructive" />
					</div>
				</Section>

				<Section description="Use shadcn Button. Never @wordpress/components Button in admin surfaces." title="Buttons">
					<div className="flex flex-wrap items-center gap-3">
						<Button>Default</Button>
						<Button variant="outline">Outline</Button>
						<Button variant="ghost">Ghost</Button>
						<Button variant="destructive">Destructive</Button>
						<Button size="sm">Small</Button>
					</div>
				</Section>

				<Section
					description="ToggleGroup is right for 2-3 short-/icon-able options. CompactSelect is right for 3+ verbose options. Both share h-8 + bg-muted hover so they read as one family."
					title="Selectors"
				>
					<div className="grid grid-cols-1 md:grid-cols-2 gap-8">
						<div>
							<Overline className="!mb-3 !block">ToggleGroup (Country-style)</Overline>
							<ToggleGroup size="sm" type="single" value={ toggle } onValueChange={ v => v && setToggle( v ) }>
								<ToggleGroupItem value="map">
									<Globe className="h-4 w-4" />
								</ToggleGroupItem>
								<ToggleGroupItem value="list">
									<List className="h-4 w-4" />
								</ToggleGroupItem>
							</ToggleGroup>
						</div>
						<div>
							<Overline className="!mb-3 !block">CompactSelect (UTM-style)</Overline>
							<CompactSelect
								label="Group by"
								options={ [
									{
										value: 'source_campaign',
										label: 'source / campaign',
									},
									{
										value: 'source_medium',
										label: 'source / medium',
									},
									{
										value: 'campaign',
										label: 'campaign only',
									},
								] }
								value={ select }
								onChange={ setSelect }
							/>
						</div>
					</div>
				</Section>

				<Section description="Shared between Analytics page Summary and Content Explorer hero strip. Pass delta + deltaTone for prior-period comparison." title="Metric tiles">
					<div className="grid gap-4 grid-cols-2 xl:grid-cols-4">
						<MetricTile label={ __( 'Page views', 'altis' ) } value="12,418" />
						<MetricTile delta={ computeDelta( 412, 318 ) } deltaTone="positive" label={ __( 'Visitors', 'altis' ) } value="412" />
						<MetricTile delta={ computeDelta( 87, 142 ) } deltaTone="negative" label={ __( 'Bounce rate', 'altis' ) } value="61%" />
						<MetricTile delta={ computeDelta( 5, 0 ) } deltaTone="neutral" hint={ __( 'No prior data', 'altis' ) } label={ __( 'New metric', 'altis' ) } value="5" />
					</div>
				</Section>

				<Section
					description="Canonical row treatment used by both Analytics BarList and BreakdownPanel HostList. Contract: h-8 row, bg-brand/15 full-height bar, label absolute left-2, space-y-1.5 between rows."
					title="List rows"
				>
					<RowDemo />
				</Section>

				<Section
					description="Card headers always reserve h-8 of vertical space (min-h-8) so a tile with a trailing action (CompactSelect, ToggleGroup, button) sits at the same baseline as a tile with title only. Without this, the row collapses to text height when no action is present and the body content jumps up — visible in side-by-side widget cards."
					title="Card headers"
				>
					<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
						<div className="rounded-lg border border-gray-200 bg-white p-6 shadow-xs">
							<div className="mb-4 flex min-h-8 items-center justify-between gap-3">
								<h3 className="!m-0 !text-sm !font-medium !text-muted-foreground">Title only</h3>
							</div>
							<Caption className="!m-0">Body content sits at the same Y as the tile next to it.</Caption>
						</div>
						<div className="rounded-lg border border-gray-200 bg-white p-6 shadow-xs">
							<div className="mb-4 flex min-h-8 items-center justify-between gap-3">
								<h3 className="!m-0 !text-sm !font-medium !text-muted-foreground">With action</h3>
								<CompactSelect
									label="Group by"
									options={ [
										{
											value: 'a',
											label: 'option a',
										},
										{
											value: 'b',
											label: 'option b',
										},
									] }
									value="a"
									onChange={ () => {} }
								/>
							</div>
							<Caption className="!m-0">Action sits flush; body content baseline matches the left card.</Caption>
						</div>
					</div>
				</Section>

				<Section description="prefers-reduced-motion is respected globally — reduced-motion users see straight renders, not transitions." title="Motion">
					<Caption>See AnimatedNumber + rank-pulse demos on the live Content Explorer page.</Caption>
				</Section>
			</div>
		</div>
	);
}
