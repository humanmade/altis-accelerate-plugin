interface Props {
	title?: string,
	version: string,
}

// Accelerate logo mark (triangle)
const LogoMark = () => (
	<svg
		className="Logo__mark"
		fill="none"
		height="24"
		viewBox="0 0 253 199"
		width="30"
		xmlns="http://www.w3.org/2000/svg"
	>
		<path
			d="M235.34 186.5H29.1875L184.158 23.9502L235.34 186.5Z"
			stroke="#9332FF"
			strokeWidth="25"
		/>
	</svg>
);

export default function Header( props: Props ) {
	return (
		<div className="Header">
			<h1 className="Logo">
				<LogoMark />
				{ props.title }
			</h1>
			<div className="Version">
				{ props.version }
			</div>
		</div>
	);
}
