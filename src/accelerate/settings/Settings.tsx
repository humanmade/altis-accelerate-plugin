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
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';

interface AccountData {
	connected: boolean;
	user_name: string | null;
	error: string | null;
	manage_url: string;
	unlink_url: string;
	authorize_url: string;
}

interface SettingsData {
	telemetry_enabled: boolean;
	abilities_api_enabled: boolean;
	has_abilities_api: boolean;
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
		key: 'telemetry_enabled' | 'abilities_api_enabled',
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
						<div className="text-center text-muted-foreground">
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
									href="https://accelerateplugin.com/docs/ai-integration"
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
				</CardContent>
			</Card>

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
