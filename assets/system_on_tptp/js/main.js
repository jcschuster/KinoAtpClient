import './style.css';
import SystemOnTptpEditor from './SystemOnTptpEditor.js';

export function init(ctx, payload) {
	new SystemOnTptpEditor(ctx.root, ctx, payload);
}
