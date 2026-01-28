import React from 'react';
import styled from 'styled-components';

type OwnProps = {
	isLoading: boolean,
	percent: number,
};

const StyledPie = styled.svg<OwnProps>`
	circle {
		fill: transparent;
		stroke: ${ props => props.stroke || '#8B5CF6' };
		stroke-linecap: round;
		stroke-opacity: 0.2;
		stroke-dasharray: 101 100;
		stroke-dashoffset: 0;
		stroke-width: 3;
		transform: rotate(-90deg);
		transform-origin: center;
		transition: stroke-dasharray 0.3s ease-in-out;
	}
	circle[data-percent] {
		stroke-dasharray: ${ props => props.percent === 100 ? 101 : props.percent } 100;
		stroke-opacity: 1;
	}
	text {
		stroke-width: 0;
		fill: ${ props => props.stroke || '#8B5CF6' };
		font-weight: 500;
	}
`;

type Props = Omit<React.SVGProps<SVGSVGElement>, 'ref'> & OwnProps;

/**
 * Audience size pie chart.
 */
export default function PieChart( props: Props ) {
	const { isLoading = false, percent = 0 } = props;
	return (
		<StyledPie viewBox="0 0 36 36" { ...props }>
			<circle cx="18" cy="18" r="16" />
			<circle cx="18" cy="18" data-percent r="16" />
			<text fontSize="8" textAnchor="middle" x="18" y="21">{ isLoading ? '…' : `${ percent }%` }</text>
		</StyledPie>
	);
}
