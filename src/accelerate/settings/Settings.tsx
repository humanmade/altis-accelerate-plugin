import apiFetch from '@wordpress/api-fetch';
import { ReactNode, useEffect, useRef, useState } from '@wordpress/element';
import { __ } from '@wordpress/i18n';

import { EmptyState } from '@/components/EmptyState';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Spinner } from '@/components/ui/spinner';
import { Switch } from '@/components/ui/switch';
import { Body, Caption, PageTitle, SectionTitle } from '@/components/ui/typography';

interface AccountData {
	connected: boolean;
	user_name: string | null;
	error: string | null;
	manage_url: string;
	unlink_url: string;
	authorize_url: string;
	signin_url: string;
	site_name: string;
	site_url: string;
	content_url: string;
}

interface SettingsData {
	telemetry_enabled: boolean;
	abilities_api_enabled: boolean;
	has_abilities_api: boolean;
	outbound_tracking_enabled: boolean;
	dashboard_takeover_enabled: boolean;
}

type SettingKey = Exclude<keyof SettingsData, 'has_abilities_api'>;

interface WebsiteSettingsData {
	weekly_email_enabled: boolean;
}

export default function Settings() {
	const [ account, setAccount ] = useState<AccountData | null>( null );
	const [ settings, setSettings ] = useState<SettingsData | null>( null );
	const [ websiteSettings, setWebsiteSettings ] = useState<WebsiteSettingsData | null>( null );
	const [ isLoading, setIsLoading ] = useState( true );
	const [ loadError, setLoadError ] = useState( false );
	const [ websiteError, setWebsiteError ] = useState( false );
	const [ saving, setSaving ] = useState<string | null>( null );
	const [ leaving, setLeaving ] = useState<string | null>( null );
	const [ feedback, setFeedback ] = useState( '' );
	const [ saveFailed, setSaveFailed ] = useState( false );
	const [ reload, setReload ] = useState( 0 );
	const busy = useRef( false );

	useEffect( () => {
		let cancelled = false;
		const loadData = async () => {
			setIsLoading( true );
			setLoadError( false );
			setWebsiteError( false );
			try {
				const [ accountRes, settingsRes ] = await Promise.all( [
					apiFetch<AccountData>( { path: '/accelerate/v1/settings/account' } ),
					apiFetch<SettingsData>( { path: '/accelerate/v1/settings' } ),
				] );
				if ( cancelled ) {
					return;
				}
				setAccount( accountRes );
				setSettings( settingsRes );
				if ( accountRes.connected && ! accountRes.error ) {
					try {
						const websiteRes = await apiFetch<WebsiteSettingsData>( { path: '/accelerate/v1/settings/website' } );
						if ( ! cancelled ) {
							setWebsiteSettings( websiteRes );
						}
					} catch {
						if ( ! cancelled ) {
							setWebsiteError( true );
						}
					}
				}
			} catch {
				if ( ! cancelled ) {
					setLoadError( true );
				}
			} finally {
				if ( ! cancelled ) {
					setIsLoading( false );
				}
			}
		};
		loadData();
		return () => {
			cancelled = true;
		};
	}, [ reload ] );

	// Keep the confirmed value visible until the server accepts the change.
	const save = async ( key: SettingKey | 'weekly_email_enabled', value: boolean ) => {
		if ( busy.current ) {
			return;
		}
		busy.current = true;
		setSaving( key );
		setFeedback( '' );
		setSaveFailed( false );
		try {
			if ( key === 'weekly_email_enabled' ) {
				const result = await apiFetch<WebsiteSettingsData>( {
					path: '/accelerate/v1/settings/website',
					method: 'POST',
					data: { [ key ]: value },
				} );
				setWebsiteSettings( result );
			} else {
				const result = await apiFetch<SettingsData>( {
					path: '/accelerate/v1/settings',
					method: 'POST',
					data: { [ key ]: value },
				} );
				setSettings( result );
			}
			setFeedback( __( 'Preference saved.', 'altis' ) );
		} catch {
			setSaveFailed( true );
			setFeedback( __( 'Couldn’t save that change. Your previous setting is still in place. Try again.', 'altis' ) );
		} finally {
			busy.current = false;
			setSaving( null );
		}
	};

	const navigate = ( url: string, action: string ) => {
		if ( busy.current ) {
			return;
		}
		busy.current = true;
		setLeaving( action );
		window.location.assign( url );
	};

	// Restore controls when returning with the browser's back/forward cache.
	useEffect( () => {
		const restore = () => {
			busy.current = false; setLeaving( null );
		};
		window.addEventListener( 'pageshow', restore );
		return () => window.removeEventListener( 'pageshow', restore );
	}, [] );

	if ( isLoading ) {
		return <div className="max-w-2xl py-4 pl-[5%]" role="status"><Spinner className="mr-2 inline-block" />{ __( 'Loading connection and options…', 'altis' ) }</div>;
	}
	if ( loadError || ! account || ! settings ) {
		return <EmptyState action={ <Button onClick={ () => setReload( value => value + 1 ) }>{ __( 'Try again', 'altis' ) }</Button> } description={ __( 'Your settings haven’t changed.', 'altis' ) } title={ __( 'Couldn’t load your connection', 'altis' ) } />;
	}

	const connected = account.connected && ! account.error;
	const disabled = !! saving || !! leaving;
	const connectionError = new URLSearchParams( window.location.search ).get( 'connection_error' );
	const option = ( key: SettingKey | 'weekly_email_enabled', label: string, description: ReactNode, unavailable = false ) => (
		<div key={ key } className="flex items-start justify-between gap-6 py-4">
			<div className="space-y-1">
				<Label htmlFor={ key }>{ label }</Label>
				<div className="space-y-1">{ description }</div>
			</div>
			<div aria-busy={ saving === key } className="flex shrink-0 items-center gap-2 pt-1">
				{ saving === key && <Spinner aria-label={ __( 'Saving…', 'altis' ) } role="status" /> }
				<Switch checked={ key === 'weekly_email_enabled' ? websiteSettings?.weekly_email_enabled ?? false : settings[ key ] } disabled={ disabled || unavailable } id={ key } onCheckedChange={ value => save( key, value ) } />
			</div>
		</div>
	);

	return (
		<div className="max-w-2xl space-y-6 py-4 pl-[5%]">
			<Card>
				<CardHeader className="space-y-3">
					<PageTitle>{ connected ? __( 'Your site is connected', 'altis' ) : __( 'Connect your site to Accelerate', 'altis' ) }</PageTitle>
					<Body>{ connected ? __( 'Choose your options here, then continue to your content.', 'altis' ) : __( 'Understand your content’s performance and try ways to improve it, right in WordPress.', 'altis' ) }</Body>
					<div className="border-y border-border py-3">
						<Body className="!font-medium">{ account.site_name }</Body>
						<Caption className="break-all">{ account.site_url }</Caption>
					</div>
				</CardHeader>
				<CardContent className="space-y-5">
					{ ( account.error || connectionError ) && <Body className="!text-destructive" role="alert">{ connectionError === 'expired' ? __( 'This connection request has expired. Start a fresh connection below.', 'altis' ) : __( 'We couldn’t confirm the connection. Try connecting again. Your account and content are preserved.', 'altis' ) }</Body> }
					{ connected ? (
						<div className="flex flex-wrap gap-3">
							<Button aria-busy={ leaving === 'content' } disabled={ disabled } onClick={ () => navigate( account.content_url, 'content' ) }>{ leaving === 'content' && <Spinner /> }{ __( 'Continue to your content', 'altis' ) }</Button>
							<Button asChild variant="outline"><a href={ account.manage_url } rel="noopener noreferrer" target="_blank">{ __( 'Your sites', 'altis' ) }</a></Button>
							<Button aria-busy={ leaving === 'unlink' } disabled={ disabled } variant="ghost" onClick={ () => navigate( account.unlink_url, 'unlink' ) }>{ leaving === 'unlink' && <Spinner /> }{ __( 'Disconnect', 'altis' ) }</Button>
						</div>
					) : (
						<>
							<div className="flex flex-wrap gap-3">
								<Button aria-busy={ leaving === 'create' } disabled={ disabled } onClick={ () => navigate( account.authorize_url, 'create' ) }>{ leaving === 'create' && <Spinner /> }{ __( 'Create account', 'altis' ) }</Button>
								<Button aria-busy={ leaving === 'signin' } disabled={ disabled } variant="outline" onClick={ () => navigate( account.signin_url, 'signin' ) }>{ leaving === 'signin' && <Spinner /> }{ __( 'Sign in', 'altis' ) }</Button>
							</div>
							<Caption>{ __( 'You’ll continue on the Accelerate website, then return here. Connecting won’t change your content.', 'altis' ) }</Caption>
						</>
					) }
					<Separator />
					<div>
						<SectionTitle>{ __( 'Settings', 'altis' ) }</SectionTitle>
						<Caption>{ __( 'Configure Accelerate preferences', 'altis' ) }</Caption>
						{ option( 'dashboard_takeover_enabled', __( 'Analytics Dashboard', 'altis' ), <Caption>{ __( 'Replace the default WordPress dashboard with the Accelerate analytics view.', 'altis' ) }</Caption> ) }
						<Separator />
						{ option( 'telemetry_enabled', __( 'Product Analytics', 'altis' ), <Caption>{ __( 'We\'re building personalized site insights — like testing benchmarks and performance stats. Keep this enabled so your data is ready when they launch. This also helps us understand which features matter most so we can build the right things.', 'altis' ) }</Caption> ) }
						<Separator />
						{ option( 'abilities_api_enabled', __( 'AI Abilities API', 'altis' ), <>
							<Caption>{ __( 'Connect AI assistants like ChatGPT or Claude to your site. They can access your analytics, create and manage A/B tests, and help optimize your content strategy.', 'altis' ) }</Caption>
							<Caption><a className="!text-brand hover:underline" href="https://www.accelerateplugin.com/docs/ai-integration" rel="noopener noreferrer" target="_blank">{ __( 'Learn more about AI integration', 'altis' ) }</a></Caption>
							{ ! settings.has_abilities_api && <Caption className="!text-amber-600">{ __( 'Requires WordPress 6.9+', 'altis' ) }</Caption> }
						</>, ! settings.has_abilities_api ) }
						<Separator />
						{ option( 'outbound_tracking_enabled', __( 'Outbound Click Tracking', 'altis' ), <>
							<Caption>{ __( 'Track clicks on links that lead off your site, grouped by destination domain. Powers the Outbound clicks tile in Content Explorer.', 'altis' ) }</Caption>
							<Caption>{ __( 'Only the destination host is recorded — no full URLs, no query strings, no path. Turning this off later stops new tracking but keeps any existing data, so re-enabling restores the historical view.', 'altis' ) }</Caption>
						</> ) }
						<Separator />
						{ option( 'weekly_email_enabled', __( 'Weekly Email Report', 'altis' ), <>
							<Caption>{ __( 'Receive a weekly summary of your site analytics by email.', 'altis' ) }</Caption>
							{ ! connected && <Caption>{ __( 'Connect your account to choose weekly reports here.', 'altis' ) }</Caption> }
						</>, ! connected || ! websiteSettings ) }
						{ websiteError && <div role="alert"><Caption>{ __( 'Couldn’t load your email preference. It hasn’t changed.', 'altis' ) }</Caption><Button disabled={ disabled } size="sm" variant="link" onClick={ () => setReload( value => value + 1 ) }>{ __( 'Try again', 'altis' ) }</Button></div> }
					</div>
					{ feedback && <Body className={ saveFailed ? '!text-destructive' : '' } role={ saveFailed ? 'alert' : 'status' }>{ feedback }</Body> }
					{ ! connected && <Button disabled={ disabled } variant="ghost" onClick={ () => navigate( 'plugins.php', 'later' ) }>{ leaving === 'later' && <Spinner /> }{ __( 'Set up later', 'altis' ) }</Button> }
				</CardContent>
			</Card>
		</div>
	);
}
