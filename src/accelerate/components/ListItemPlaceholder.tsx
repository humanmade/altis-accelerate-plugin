import ContentLoader from 'react-content-loader';

type Props = {
	i: number,
	isNestable?: boolean,
};

const loaderProps = {
	speed: 2,
	foregroundColor: "hsl(0, 0%, 99%)",
	backgroundColor: "hsl(0, 0%, 95%)"
};

const ListItemPlaceholder = function ( props: Props ) {
	const {
		i,
		isNestable = false,
	} = props;

	return (
		<tr key={ `placeholder-${i}` } className="record-placeholder">
			{ isNestable ? (
				<td className="record-expand">&nbsp;</td>
			) : null }
			<td className="record-thumbnail">
				<ContentLoader
					{ ...loaderProps }
					height={ 47 }
					width={ 105 }
				>
					<rect height={ 47 } rx="2" ry="2" width={ 105 } x={ 0 } y={ 0 } />
				</ContentLoader>
			</td>
			<td className="record-name">
				<ContentLoader
					{ ...loaderProps }
					height={ 46 }
					width={ 170 }
				>
					<rect height={ 6 } rx="5" ry="5" width={ 170 } x={ 0 } y={ 15 } />
					<rect height={ 6 } rx="5" ry="5" width={ 90 } x={ 0 } y={ 30 } />
					<rect height={ 6 } rx="5" ry="5" width={ 50 } x={ 100 } y={ 30 } />
				</ContentLoader>
			</td>
			<td className="record-traffic">
				<ContentLoader
					{ ...loaderProps }
					height={ 46 }
					width={ 180 }
				>
					<rect height={ 6 } rx="5" ry="5" width={ 58 } x={ 120 } y={ 15 } />
					<rect height={ 6 } rx="5" ry="5" width={ 48 } x={ 120 } y={ 30 } />

					<rect height={ 15 } rx="2" ry="2" width={ 11 } x={ 83 - 83 } y={ 20 } />
					<rect height={ 5 } rx="2" ry="2" width={ 11 } x={ 97 - 83 } y={ 30 } />
					<rect height={ 15 } rx="2" ry="2" width={ 11 } x={ 111 - 83 } y={ 20 } />
					<rect height={ 5 } rx="2" ry="2" width={ 11 } x={ 125 - 83 } y={ 30 } />
					<rect height={ 15 } rx="2" ry="2" width={ 11 } x={ 139 - 83 } y={ 20 } />
					<rect height={ 10 } rx="2" ry="2" width={ 11 } x={ 153 - 83 } y={ 25 } />
					<rect height={ 5 } rx="2" ry="2" width={ 11 } x={ 167 - 83 } y={ 30 } />
				</ContentLoader>
			</td>
			<td className="record-lift">&nbsp;</td>
			<td className="record-meta">
				<ContentLoader
					{ ...loaderProps }
					height={ 46 }
					width={ 160 }
				>
					<rect height={ 30 } rx="5" ry="5" width={ 30 } x={ 0 } y={ 10 } />
					<rect height={ 6 } rx="5" ry="5" width={ 110 } x={ 46 } y={ 15 } />
					<rect height={ 6 } rx="5" ry="5" width={ 70 } x={ 46 } y={ 30 } />
				</ContentLoader>
			</td>
		</tr>
	);
};

export default ListItemPlaceholder;
