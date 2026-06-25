import './style.css';
import BackendConfigForm from './BackendConfigForm.js';

export function init(ctx, payload) {
	new BackendConfigForm(ctx.root, ctx, payload);
}
