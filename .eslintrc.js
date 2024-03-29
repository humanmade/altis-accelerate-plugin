/**
 * Even though this is a JavaScript file, the config data itself is formatted as JSON to allow for easier comparison,
 * as well as copy-and-paste from and to other .eslintrc JSON files.
 */

const isProduction = process.env.NODE_ENV === 'production';

module.exports = {
	'root': true,
	'extends': [
		'humanmade',
		'plugin:@wordpress/eslint-plugin/recommended',
		'plugin:import/errors',
	],
	'globals': {
		'Altis': 'readonly',
		'wp': 'readonly',
		'moment': 'readonly',
		'AltisAIBlock': 'readonly',
	},
	'settings': {
		'import/resolver': {
			'node': {
				'extensions': [ '.js', '.jsx', '.ts', '.tsx' ],
			},
		},
	},
	'rules': {
		'no-multi-str': 'off',
		'no-console': 'off',
		'no-shadow': 'off',
		'jsdoc/no-undefined-types': 'off',
		'react/react-in-jsx-scope': 'off',
		'jsdoc/check-tag-names': 'off',
		'jsdoc/check-types': 'off',
		'import/no-unresolved': [
			'error',
			{
				"commonjs": true,
				"ignore": [
					// eslint-disable-next-line no-useless-escape
					"^@wordpress\/[^/]+"
				]
			}
		],
		'jsx-a11y/no-autofocus': 'off',
	},
};

/*

module.exports = {
	"root": true,
	"extends": [
		"humanmade",
		"plugin:@wordpress/eslint-plugin/recommended",
		"plugin:import/errors"
	],
	"globals": {
		"Altis": "readonly",
		"wp": "readonly",
		"moment": "readonly"
	},
	"env": {
		"browser": true
	},
	"plugins": [
		"jsdoc"
	],
	"settings": {
		"import/resolver": {
			"node": {
				"extensions": [".js", ".jsx", ".ts", ".tsx"]
			}
		}
	},
	"rules": {
		"@wordpress/dependency-group": "off",
		"@wordpress/react-no-unsafe-timeout": "error",
		"import/no-unresolved": [
			"error",
			{
				"commonjs": true,
				"ignore": [
					// eslint-disable-next-line no-useless-escape
					"^@wordpress\/[^/]+"
				]
			}
		],
		// "jsdoc/check-param-names": "warn",
		// "jsdoc/check-tag-names": "warn",
		// "jsdoc/check-types": [
		// 	"warn",
		// 	{
		// 		"noDefaults": true
		// 	}
		// ],
		// "jsdoc/newline-after-description": "warn",
		// "jsdoc/no-undefined-types": "warn",
		// "jsdoc/require-description-complete-sentence": "warn",
		"jsdoc/require-hyphen-before-param-description": 0,
		// "jsdoc/require-param": "warn",
		// "jsdoc/require-param-description": "warn",
		// "jsdoc/require-param-name": "warn",
		// "jsdoc/require-param-type": "warn",
		// "jsdoc/require-returns-type": "warn",
		// "jsdoc/valid-types": "warn",
		// "max-len": [
		// 	"warn",
		// 	120
		// ],
		"no-console": isProduction ? "error" : "warn",
		"no-debugger": isProduction ? "error" : "warn",
		"no-multi-str": "off",
		"no-plusplus": "off",
		"no-shadow": "off",
		"no-unused-vars": [
			"warn",
			{
				"vars": "all",
				"varsIgnorePattern": "_",
				"args": "after-used",
				"argsIgnorePattern": "_",
				"ignoreRestSiblings": true
			}
		],
		"operator-linebreak": [
			"error",
			"before",
			{
				"overrides": {
					"=": "none"
				}
			}
		],
		"react/prop-types": "off",
		"react/react-in-jsx-scope": "off",
		"valid-jsdoc": [
			"off",
			{}
		],

		// There is an issue with references not being detected when used as JSX component name (e.g., App in <App />).
		"@wordpress/no-unused-vars-before-return": "off",
	}
};

*/
