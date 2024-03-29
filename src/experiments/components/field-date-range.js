import React from 'react';
import styled from 'styled-components';

import { Notice } from '.';

const { TimePicker } = wp.components;
const { __ } = wp.i18n;

const StyledDateRange = styled.div`
	.altis-experiments-date-range__label {
		margin-bottom: 2px;
	}
	select, input {
		padding-top: 2px;
		padding-bottom: 2px;
	}
`;

/**
 * Component for entering a date range.
 *
 * @param {React.ComponentProps} props Date range props.
 * @returns {React.ReactNode} Date range component.
 */
const DateRange = props => {
	const {
		description,
		endTime,
		onChangeStart,
		onChangeEnd,
		startTime,
	} = props;

	const showTimeRecommendation = ( endTime - startTime ) < ( 14 * 24 * 60 * 60 * 1000 );

	const startDate = new Date( startTime );
	const endDate = new Date( endTime );

	return (
		<StyledDateRange className="altis-experiments-date-range">
			<div className="altis-experiments-date-range__field">
				<div className="altis-experiments-date-range__label">
					{ /* eslint-disable-next-line jsx-a11y/label-has-for */ }
					<label>{ __( 'Start date', 'altis' ) }</label>
				</div>
				<TimePicker
					currentTime={ startDate.toISOString() }
					onChange={ time => {
						const newDate = new Date( time );
						onChangeStart( newDate < endDate ? newDate.getTime() : endTime - ( 24 * 60 * 60 * 1000 ) );
					} }
				/>
			</div>
			<div className="altis-experiments-date-range__field">
				<div className="altis-experiments-date-range__label">
					{ /* eslint-disable-next-line jsx-a11y/label-has-for */ }
					<label>{ __( 'End date', 'altis' ) }</label>
				</div>
				{ showTimeRecommendation && (
					<Notice>{ __( 'It is recommended to allow at least two weeks to achieve statistically significant results.', 'altis' ) }</Notice>
				) }
				<TimePicker
					currentTime={ endDate.toISOString() }
					onChange={ time => {
						const newDate = new Date( time );
						onChangeEnd( newDate > startDate ? newDate.getTime() : startTime + ( 24 * 60 * 60 * 1000 ) );
					} }
				/>
			</div>
			{ description && (
				<p className="altis-experiments-date-range__description description">{ description }</p>
			) }
		</StyledDateRange>
	);
};

DateRange.defaultProps = {
	endTime: Date.now() + ( 30 * 24 * 60 * 60 * 1000 ),
	startTime: Date.now(),
};

export default DateRange;
