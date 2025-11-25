/**
 * PostCSS plugin to insert newlines between groups of CSS properties
 * Keeps the order defined in GROUPS and uses real tabs for indentation.
 */

const GROUPS = {
	layout: [
		'visibility','position','top','right','bottom','left','z-index',
		'float','clear','order',
	],
	size: [
		'width','height','min-width','max-width','min-height','max-height'
	],
	spacing: [
		'margin','margin-top','margin-right','margin-bottom','margin-left',
		'padding','padding-top','padding-right','padding-bottom','padding-left',
		'gap','row-gap','column-gap','box-sizing'
	],
	background: [
		'background','background-color','background-image','background-position',
		'background-repeat','background-size'
	],
	border: [
		'border','border-width','border-style','border-color','border-radius'
	],
	flexGrid: [
		'display', 'flex','flex-direction','flex-wrap','align-content','place-items','place-content', 'align-items','justify-content'
	],
	grid: [
		'grid','grid-template','grid-template-rows','grid-template-columns',
		'grid-area','grid-gap','grid-row','grid-column'
	],
	
	typography: [
		'font','font-family','font-size','font-weight','font-style','line-height',
		'letter-spacing','text-align','text-decoration','text-transform',
		'white-space','word-spacing','color'
	],
	others: []
};

module.exports = () => ({
	postcssPlugin: 'postcss-group-newline',

	Once(root) {
		root.walkRules(rule => {
			let lastGroup = null;

			// find first declaration node (skip comments)
			const firstDecl = Array.from(rule.nodes || []).find(n => n && n.type === 'decl');

			rule.walkDecls(decl => {
				let currentGroup = 'others';

				// detect group by matching prop in GROUPS (preserve order)
				for (const [groupName, props] of Object.entries(GROUPS)) {
					if (props.includes(decl.prop)) {
						currentGroup = groupName;
						break;
					}
				}

				// count existing tabs before this decl (if any)
				let existingTabs = 0;
				if (decl.raws.before) {
					const match = decl.raws.before.match(/\t+$/m);
					if (match) existingTabs = match[0].length;
				}

				// If first declaration, keep single newline + original tabs
				if (decl === firstDecl) {
					decl.raws.before = '\n' + '\t'.repeat(existingTabs || 1);
					lastGroup = currentGroup;
					return;
				}

				// insert extra blank line if group changed
				if (currentGroup !== lastGroup) {
					decl.raws.before = '\n\n' + '\t'.repeat(existingTabs || 1);
					lastGroup = currentGroup;
				} else {
					decl.raws.before = '\n' + '\t'.repeat(existingTabs || 1);
				}
			});
		});
	}
});

module.exports.postcss = true;
module.exports.GROUPS = GROUPS;
