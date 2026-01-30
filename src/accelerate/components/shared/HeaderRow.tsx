import { ReactNode, CSSProperties } from 'react';

interface HeaderRowProps {
	children: ReactNode;
}

// Accelerate outlined triangle logo
const AccelerateLogo = () => (
	<svg className="w-5 h-5 text-[#9332FF]" viewBox="0 0 253 199" xmlns="http://www.w3.org/2000/svg">
		<path
			d="M235.34 186.5 H29.1875 L184.158 23.95 Z M214.9 171.5 H64.2 L177.5 52.7 Z"
			fill="currentColor"
			fillRule="evenodd"
		/>
	</svg>
);

export const HeaderRow = ( { children }: HeaderRowProps ) => {
	const style: CSSProperties = {
		backgroundColor: 'rgba(248, 248, 248, 0.65)',
		backdropFilter: 'blur(12px)',
		WebkitBackdropFilter: 'blur(12px)',
		borderBottomColor: 'rgba(204, 204, 204, 0.6)',
	};
	return (
		<div className="flex border-b font-sans" style={ style }>
			{ /* Logo area - matches WP logo square dimensions */ }
			<div className="w-[60px] flex items-center justify-center shrink-0">
				<AccelerateLogo />
			</div>
			{ /* Content area - starts at red line */ }
			<div className="flex gap-4 items-center py-3 pr-3 flex-1">
				{ children }
			</div>
		</div>
	);
};

export const VerticalDivider = () => (
	<div className="w-px -my-3" style={ { backgroundColor: '#ccc' } }></div>
);

