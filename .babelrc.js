const isProduction = process.env.NODE_ENV === 'production';

module.exports = {
	presets: [
		'@babel/preset-typescript',
		'@humanmade/webpack-helpers/babel-preset'
	]
};
