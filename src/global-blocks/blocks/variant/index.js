import blockData from '../../../../inc/global-blocks/variant/block.json';
import edit from './edit';
import save from './save';

export const name = blockData.name;

export const options = {
	...blockData,
	edit,
	save,
};
