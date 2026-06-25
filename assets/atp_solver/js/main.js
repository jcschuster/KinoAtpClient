import './style.css';
import AtpSolverEditor from './AtpSolverEditor.js';

export function init(ctx, payload) {
	new AtpSolverEditor(ctx.root, ctx, payload);
}
