import { Audience, Group, Post, Rule } from '../types';

export const defaultRule: Rule = {
	field: '',
	operator: '=', // =, !=, *, !*
	value: '', // mixed
	type: 'string', // data type, string or number
};

export const defaultGroup: Group = {
	include: 'any', // ANY, ALL, NONE
	rules: [
		defaultRule,
	],
};

export const defaultAudience: Audience = {
	include: 'all', // ANY, ALL, NONE
	groups: [
		defaultGroup,
	],
};

export const defaultPost: Partial<Post> = {
	title: {
		rendered: '',
		raw: '',
	},
	type: 'post',
	slug: '',
	menu_order: 0,
	audience: defaultAudience,
	status: 'draft',
};
