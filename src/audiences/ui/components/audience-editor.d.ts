import React from 'react';

import { Audience } from '../types';

interface AudienceEditorProps {
	audience: Audience;
	onChange: ( audience: Audience ) => void;
}

declare const AudienceEditor: React.FC<AudienceEditorProps>;

export default AudienceEditor;
