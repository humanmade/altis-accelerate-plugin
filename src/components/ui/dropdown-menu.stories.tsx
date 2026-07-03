import type { Meta, StoryObj } from '@storybook/react-vite';
import { Copy, Pencil, Trash2 } from 'lucide-react';
import * as React from 'react';

import { Button } from './button';
import {
	DropdownMenu,
	DropdownMenuCheckboxItem,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from './dropdown-menu';

const meta: Meta<typeof DropdownMenu> = {
	title: 'Components/UI/DropdownMenu',
	component: DropdownMenu,
};

export default meta;

type Story = StoryObj<typeof DropdownMenu>;

export const Default: Story = {
	render: () => (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button variant="outline">Actions</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent>
				<DropdownMenuItem>
					<Pencil aria-hidden="true" className="mr-2 h-4 w-4" />
					Rename experiment
				</DropdownMenuItem>
				<DropdownMenuItem>
					<Copy aria-hidden="true" className="mr-2 h-4 w-4" />
					Duplicate
				</DropdownMenuItem>
				<DropdownMenuSeparator />
				<DropdownMenuItem className="text-destructive">
					<Trash2 aria-hidden="true" className="mr-2 h-4 w-4" />
					Delete
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	),
};

export const WithCheckboxes: Story = {
	render: () => {
		const [ showArchived, setShowArchived ] = React.useState( false );
		const [ showDrafts, setShowDrafts ] = React.useState( true );
		return (
			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<Button variant="outline">Filter</Button>
				</DropdownMenuTrigger>
				<DropdownMenuContent>
					<DropdownMenuLabel>Show</DropdownMenuLabel>
					<DropdownMenuCheckboxItem checked={ showDrafts } onCheckedChange={ setShowDrafts }>
						Draft experiments
					</DropdownMenuCheckboxItem>
					<DropdownMenuCheckboxItem checked={ showArchived } onCheckedChange={ setShowArchived }>
						Archived experiments
					</DropdownMenuCheckboxItem>
				</DropdownMenuContent>
			</DropdownMenu>
		);
	},
};

export const RadioSelection: Story = {
	render: () => {
		const [ groupBy, setGroupBy ] = React.useState( 'source' );
		return (
			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<Button variant="outline">Group by</Button>
				</DropdownMenuTrigger>
				<DropdownMenuContent>
					<DropdownMenuRadioGroup value={ groupBy } onValueChange={ setGroupBy }>
						<DropdownMenuRadioItem value="source">Source</DropdownMenuRadioItem>
						<DropdownMenuRadioItem value="campaign">Campaign</DropdownMenuRadioItem>
						<DropdownMenuRadioItem value="device">Device</DropdownMenuRadioItem>
					</DropdownMenuRadioGroup>
				</DropdownMenuContent>
			</DropdownMenu>
		);
	},
};
