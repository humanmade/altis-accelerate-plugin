import React, { useCallback, useEffect, useState } from 'react';

import apiFetch from '@wordpress/api-fetch';
import { __ } from '@wordpress/i18n';

import { Button } from '@/components/ui/button';
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Spinner } from '@/components/ui/spinner';
import { Switch } from '@/components/ui/switch';

interface AccountData {
	connected: boolean;
	user_name: string | null;
	error: string | null;
	manage_url: string;
	unlink_url: string;
	authorize_url: string;
}

interface HubSpotSyncStatus {
	synced_at: number | null;
	form_count: number;
	email_count: number;
	error: string | null;
}

interface SettingsData {
	telemetry_enabled: boolean;
	abilities_api_enabled: boolean;
	has_abilities_api: boolean;
	outbound_tracking_enabled: boolean;
	dashboard_takeover_enabled: boolean;
	hubspot_available: boolean;
	hubspot_enabled?: boolean;
	hubspot_token_set?: boolean;
	hubspot_sync?: HubSpotSyncStatus;
}

interface WebsiteSettingsData {
	weekly_email_enabled: boolean;
}

export default function Settings() {
	const [ account, setAccount ] = useState<AccountData | null>( null );
	const [ settings, setSettings ] = useState<SettingsData | null>( null );
	const [ websiteSettings, setWebsiteSettings ] = useState<WebsiteSettingsData | null>( null );
	const [ isLoading, setIsLoading ] = useState( true );

	// Load data on mount
	useEffect( () => {
		const loadData = async () => {
			try {
				const [ accountRes, settingsRes ] = await Promise.all( [
					apiFetch<AccountData>( { path: '/accelerate/v1/settings/account' } ),
					apiFetch<SettingsData>( { path: '/accelerate/v1/settings' } ),
				] );
				setAccount( accountRes );
				setSettings( settingsRes );

				// Load website settings if connected.
				if ( accountRes?.connected ) {
					try {
						const websiteRes = await apiFetch<WebsiteSettingsData>( {
							path: '/accelerate/v1/settings/website',
						} );
						setWebsiteSettings( websiteRes );
					} catch {
						// Website settings are optional — don't block the page.
					}
				}
			} catch ( error ) {
				console.error( 'Failed to load settings:', error );
			} finally {
				setIsLoading( false );
			}
		};
		loadData();
	}, [] );

	// Auto-save setting when changed
	const updateSetting = useCallback( async (
		key: 'telemetry_enabled' | 'abilities_api_enabled' | 'outbound_tracking_enabled' | 'dashboard_takeover_enabled' | 'hubspot_enabled',
		value: boolean
	) => {
		// Update local state immediately
		setSettings( prev => prev ? {
			...prev,
			[ key ]: value,
		} : null );

		// Save to server
		try {
			await apiFetch( {
				path: '/accelerate/v1/settings',
				method: 'POST',
				data: { [ key ]: value },
			} );
		} catch ( error ) {
			console.error( 'Failed to save setting:', error );
			// Revert on error
			setSettings( prev => prev ? {
				...prev,
				[ key ]: ! value,
			} : null );
		}
	}, [] );

	// HubSpot token entry. Unlike the toggles this is NOT optimistic-save:
	// the server validates the token against the HubSpot API before storing
	// it, and we surface the validation result.
	const [ hubspotToken, setHubspotToken ] = useState( '' );
	const [ hubspotTokenSaving, setHubspotTokenSaving ] = useState( false );
	const [ hubspotTokenError, setHubspotTokenError ] = useState<string | null>( null );
	const [ hubspotSyncing, setHubspotSyncing ] = useState( false );

	const saveHubspotToken = useCallback( async ( token: string ) => {
		setHubspotTokenSaving( true );
		setHubspotTokenError( null );
		try {
			const updated = await apiFetch<SettingsData>( {
				path: '/accelerate/v1/settings',
				method: 'POST',
				data: { hubspot_token: token },
			} );
			setSettings( updated );
			setHubspotToken( '' );
		} catch ( error ) {
			setHubspotTokenError( ( error as { message?: string } )?.message || __( 'Could not validate the token.', 'altis' ) );
		} finally {
			setHubspotTokenSaving( false );
		}
	}, [] );

	const syncHubspotNow = useCallback( async () => {
		setHubspotSyncing( true );
		setHubspotTokenError( null );
		try {
			const sync = await apiFetch<HubSpotSyncStatus>( {
				path: '/accelerate/v1/hubspot/sync',
				method: 'POST',
			} );
			setSettings( prev => prev ? {
				...prev,
				hubspot_sync: sync,
			} : null );
		} catch ( error ) {
			setHubspotTokenError( ( error as { message?: string } )?.message || __( 'Sync failed.', 'altis' ) );
		} finally {
			setHubspotSyncing( false );
		}
	}, [] );

	// Auto-save website setting when changed
	const updateWebsiteSetting = useCallback( async (
		key: keyof WebsiteSettingsData,
		value: boolean
	) => {
		// Update local state immediately
		setWebsiteSettings( prev => prev ? {
			...prev,
			[ key ]: value,
		} : null );

		// Save to server
		try {
			await apiFetch( {
				path: '/accelerate/v1/settings/website',
				method: 'POST',
				data: { [ key ]: value },
			} );
		} catch ( error ) {
			console.error( 'Failed to save website setting:', error );
			// Revert on error
			setWebsiteSettings( prev => prev ? {
				...prev,
				[ key ]: ! value,
			} : null );
		}
	}, [] );

	if ( isLoading ) {
		return (
			<div className="max-w-2xl space-y-6 py-4 pl-[5%]">
				<Card>
					<CardContent className="py-8">
						<div className="flex items-center justify-center gap-2 text-muted-foreground">
							<Spinner />
							{ __( 'Loading...', 'altis' ) }
						</div>
					</CardContent>
				</Card>
			</div>
		);
	}

	return (
		<div className="max-w-2xl space-y-6 py-4 pl-[5%]">
			{ /* Account Card */ }
			<Card>
				<CardHeader>
					<CardTitle>{ __( 'Account', 'altis' ) }</CardTitle>
					<CardDescription>
						{ __( 'Manage your Accelerate account connection', 'altis' ) }
					</CardDescription>
				</CardHeader>
				<CardContent>
					{ account?.connected ? (
						<>
							{ account.error ? (
								<div className="space-y-3">
									<p className="text-sm text-destructive">
										{ __( 'Connection failed:', 'altis' ) }{ ' ' }
										<code className="text-xs">{ account.error }</code>
									</p>
									<div className="flex gap-2">
										<Button asChild variant="outline">
											<a href={ account.authorize_url }>
												{ __( 'Relink Account', 'altis' ) }
											</a>
										</Button>
									</div>
								</div>
							) : (
								<div className="space-y-3">
									<p className="text-sm">
										{ __( 'Connected as', 'altis' ) }{ ' ' }
										<strong>{ account.user_name }</strong>
									</p>
									<div className="flex gap-2">
										<Button asChild variant="outline">
											<a
												href={ account.manage_url }
												rel="noopener noreferrer"
												target="_blank"
											>
												{ __( 'Manage Account', 'altis' ) }
											</a>
										</Button>
										<Button asChild variant="outline">
											<a href={ account.unlink_url }>
												{ __( 'Unlink', 'altis' ) }
											</a>
										</Button>
									</div>
								</div>
							) }
						</>
					) : (
						<div className="space-y-3">
							<p className="text-sm text-muted-foreground">
								{ __(
									'Connect your site to Accelerate to enable analytics and personalization features.',
									'altis'
								) }
							</p>
							<Button asChild>
								<a href={ account?.authorize_url }>
									{ __( 'Connect Account', 'altis' ) }
								</a>
							</Button>
						</div>
					) }
				</CardContent>
			</Card>

			{ /* Settings Card */ }
			<Card>
				<CardHeader>
					<CardTitle>{ __( 'Settings', 'altis' ) }</CardTitle>
					<CardDescription>
						{ __( 'Configure Accelerate preferences', 'altis' ) }
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-6">
					{ /* Analytics Dashboard Toggle */ }
					<div className="flex items-start justify-between gap-4">
						<div className="space-y-1">
							<Label className="text-sm font-medium" htmlFor="dashboard-takeover">
								{ __( 'Analytics Dashboard', 'altis' ) }
							</Label>
							<p className="text-sm text-muted-foreground">
								{ __( 'Replace the default WordPress dashboard with the Accelerate analytics view.', 'altis' ) }
							</p>
						</div>
						<Switch
							checked={ settings?.dashboard_takeover_enabled ?? true }
							id="dashboard-takeover"
							onCheckedChange={ checked => updateSetting( 'dashboard_takeover_enabled', checked ) }
						/>
					</div>

					<Separator />

					{ /* Product Analytics Toggle */ }
					<div className="flex items-start justify-between gap-4">
						<div className="space-y-1">
							<Label className="text-sm font-medium" htmlFor="telemetry-switch">
								{ __( 'Product Analytics', 'altis' ) }
							</Label>
							<p className="text-sm text-muted-foreground">
								{ __(
									'We\'re building personalized site insights — like testing benchmarks and performance stats. Keep this enabled so your data is ready when they launch. This also helps us understand which features matter most so we can build the right things.',
									'altis'
								) }
							</p>
						</div>
						<Switch
							checked={ settings?.telemetry_enabled ?? false }
							id="telemetry-switch"
							onCheckedChange={ checked => updateSetting( 'telemetry_enabled', checked ) }
						/>
					</div>

					<Separator />

					{ /* AI Abilities API Toggle */ }
					<div className="flex items-start justify-between gap-4">
						<div className="space-y-1">
							<Label
								className="text-sm font-medium"
								htmlFor="abilities-switch"
							>
								{ __( 'AI Abilities API', 'altis' ) }
							</Label>
							<p className="text-sm text-muted-foreground">
								{ __(
									'Connect AI assistants like ChatGPT or Claude to your site. They can access your analytics, create and manage A/B tests, and help optimize your content strategy.',
									'altis'
								) }
							</p>
							<p className="text-xs text-muted-foreground">
								<a
									className="!text-brand hover:underline"
									href="https://www.accelerateplugin.com/docs/ai-integration"
									rel="noopener noreferrer"
									target="_blank"
								>
									{ __( 'Learn more about AI integration', 'altis' ) }
								</a>
							</p>
							{ ! settings?.has_abilities_api && (
								<p className="text-xs text-amber-600">
									{ __( 'Requires WordPress 6.9+', 'altis' ) }
								</p>
							) }
						</div>
						<Switch
							checked={ settings?.abilities_api_enabled ?? false }
							disabled={ ! settings?.has_abilities_api }
							id="abilities-switch"
							onCheckedChange={ checked => updateSetting( 'abilities_api_enabled', checked ) }
						/>
					</div>

					<Separator />

					{ /* Outbound Click Tracking Toggle */ }
					<div className="flex items-start justify-between gap-4">
						<div className="space-y-1">
							<Label
								className="text-sm font-medium"
								htmlFor="outbound-switch"
							>
								{ __( 'Outbound Click Tracking', 'altis' ) }
							</Label>
							<p className="text-sm text-muted-foreground">
								{ __(
									'Track clicks on links that lead off your site, grouped by destination domain. Powers the Outbound clicks tile in Content Explorer.',
									'altis'
								) }
							</p>
							<p className="text-xs text-muted-foreground">
								{ __(
									'Only the destination host is recorded — no full URLs, no query strings, no path. Turning this off later stops new tracking but keeps any existing data, so re-enabling restores the historical view.',
									'altis'
								) }
							</p>
						</div>
						<Switch
							checked={ settings?.outbound_tracking_enabled ?? false }
							id="outbound-switch"
							onCheckedChange={ checked => updateSetting( 'outbound_tracking_enabled', checked ) }
						/>
					</div>
				</CardContent>
			</Card>

			{ /* HubSpot Integration Card */ }
			{ settings?.hubspot_available && (
				<Card>
					<CardHeader>
						<CardTitle>{ __( 'HubSpot', 'altis' ) }</CardTitle>
						<CardDescription>
							{ __( 'Capture HubSpot form submissions, marketing email arrivals and chat engagement as audience criteria', 'altis' ) }
						</CardDescription>
					</CardHeader>
					<CardContent className="space-y-6">
						<div className="flex items-start justify-between gap-4">
							<div className="space-y-1">
								<Label className="text-sm font-medium" htmlFor="hubspot-switch">
									{ __( 'Enable HubSpot signals', 'altis' ) }
								</Label>
								<p className="text-sm text-muted-foreground">
									{ __(
										'Records which HubSpot forms a visitor submits, which marketing emails they arrive from, and whether they engage with the chat widget. Only the interaction and the asset name are captured — never form values or chat messages.',
										'altis'
									) }
								</p>
							</div>
							<Switch
								checked={ settings?.hubspot_enabled ?? false }
								id="hubspot-switch"
								onCheckedChange={ checked => updateSetting( 'hubspot_enabled', checked ) }
							/>
						</div>

						{ settings?.hubspot_enabled && (
							<>
								<Separator />

								<div className="space-y-2">
									<Label className="text-sm font-medium" htmlFor="hubspot-token">
										{ __( 'Private app access token', 'altis' ) }
									</Label>
									<p className="text-sm text-muted-foreground">
										{ __(
											'Optional — used to resolve HubSpot form and email IDs to their names so audiences read naturally. Create a private app with read access to Forms and Marketing Email. Without a token, signals are still captured using raw HubSpot IDs.',
											'altis'
										) }
									</p>
									<div className="flex gap-2">
										<Input
											autoComplete="off"
											disabled={ hubspotTokenSaving }
											id="hubspot-token"
											placeholder={ settings?.hubspot_token_set
												? __( 'Token saved — enter a new token to replace it', 'altis' )
												: 'pat-xx-xxxxxxxx-…' }
											type="password"
											value={ hubspotToken }
											onChange={ e => setHubspotToken( e.target.value ) }
										/>
										<Button
											disabled={ hubspotTokenSaving || hubspotToken.trim() === '' }
											onClick={ () => saveHubspotToken( hubspotToken.trim() ) }
										>
											{ hubspotTokenSaving ? <Spinner /> : __( 'Save & validate', 'altis' ) }
										</Button>
										{ settings?.hubspot_token_set && (
											<Button
												disabled={ hubspotTokenSaving }
												variant="outline"
												onClick={ () => saveHubspotToken( '' ) }
											>
												{ __( 'Remove', 'altis' ) }
											</Button>
										) }
									</div>
									{ hubspotTokenError && (
										<p className="text-sm text-destructive">{ hubspotTokenError }</p>
									) }
								</div>

								{ settings?.hubspot_token_set && (
									<div className="flex items-center justify-between gap-4">
										<p className="text-sm text-muted-foreground">
											{ settings?.hubspot_sync?.synced_at ? (
												<>
													{ __( 'Last synced', 'altis' ) }{ ' ' }
													{ new Date( settings.hubspot_sync.synced_at * 1000 ).toLocaleString() }
													{ ' — ' }
													{ settings.hubspot_sync.form_count }{ ' ' }{ __( 'forms', 'altis' ) }
													{ ', ' }
													{ settings.hubspot_sync.email_count }{ ' ' }{ __( 'emails', 'altis' ) }
												</>
											) : __( 'Directories not synced yet.', 'altis' ) }
											{ settings?.hubspot_sync?.error && (
												<span className="text-destructive">
													{ ' ' }{ settings.hubspot_sync.error }
												</span>
											) }
										</p>
										<Button
											disabled={ hubspotSyncing }
											variant="outline"
											onClick={ syncHubspotNow }
										>
											{ hubspotSyncing ? <Spinner /> : __( 'Sync now', 'altis' ) }
										</Button>
									</div>
								) }
							</>
						) }
					</CardContent>
				</Card>
			) }

			{ /* Notifications Card — only when connected */ }
			{ account?.connected && websiteSettings && (
				<Card>
					<CardHeader>
						<CardTitle>{ __( 'Notifications', 'altis' ) }</CardTitle>
						<CardDescription>
							{ __( 'Manage email notifications from Accelerate', 'altis' ) }
						</CardDescription>
					</CardHeader>
					<CardContent className="space-y-6">
						<div className="flex items-start justify-between gap-4">
							<div className="space-y-1">
								<Label className="text-sm font-medium" htmlFor="weekly-email-switch">
									{ __( 'Weekly Email Report', 'altis' ) }
								</Label>
								<p className="text-sm text-muted-foreground">
									{ __(
										'Receive a weekly summary of your site analytics by email.',
										'altis'
									) }
								</p>
							</div>
							<Switch
								checked={ websiteSettings.weekly_email_enabled }
								id="weekly-email-switch"
								onCheckedChange={ checked => updateWebsiteSetting( 'weekly_email_enabled', checked ) }
							/>
						</div>
					</CardContent>
				</Card>
			) }
		</div>
	);
}
