import { __ } from '@wordpress/i18n';

interface Props {
	title?: string,
	version: string,
}

export default function Header( props: Props ) {
	return (
		<div className="Header">
			<h1 className="Logo">
				<span className="Beta">
					{ __( 'BETA', 'altis' ) }
				</span>
				{ props.title }
			</h1>
			<div className="Version">
				{ props.version }
			</div>
		</div>
	);
}
