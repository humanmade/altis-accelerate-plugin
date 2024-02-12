import { __ } from '@wordpress/i18n';

import Logo from './altis-logo.svg';

import './Header.css';

interface Props {
	title?: string,
	version?: string,
}

export default function Header( props: Props ) {
	return (
		<div className="Header">
			<h1 className="Logo">
				<img alt="Altis Accelerate" height="26" src={ Logo } width="64" />
				<span className="Beta">
					{ __( 'BETA', 'altis' ) }
				</span>
				{ props.title }
			</h1>
			<div className="Version">
				{ props?.version }
			</div>
		</div>
	)
}
