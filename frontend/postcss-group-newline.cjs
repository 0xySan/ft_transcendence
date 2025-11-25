/**
 * PostCSS plugin to insert newlines between groups of CSS properties
 * Keeps the order defined in GROUPS and uses real tabs for indentation.
 */

const GROUPS = {
	layout: [
		'display','position','top','right','bottom','left','z-index',
		'float','clear','order','align-items','justify-content'
	],
	size: [
		'width','height','min-width','max-width','min-height','max-height'
	],
	spacing: [
		'margin','margin-top','margin-right','margin-bottom','margin-left',
		'padding','padding-top','padding-right','padding-bottom','padding-left',
		'gap','row-gap','column-gap','box-sizing'
	],
	typography: [
		'font','font-family','font-size','font-weight','font-style','line-height',
		'letter-spacing','text-align','text-decoration','text-transform',
		'white-space','word-spacing','color'
	],
	background: [
		'background','background-color','background-image','background-position',
		'background-repeat','background-size'
	],
	border: [
		'border','border-width','border-style','border-color','border-radius'
	],
	visual: [
		'box-shadow','opacity','transition','transform','animation',
		'outline','cursor','user-select','appearance'
	],
	flexGrid: [
		'flex','flex-direction','flex-wrap','align-content','place-items','place-content'
	],
	grid: [
		'grid','grid-template','grid-template-rows','grid-template-columns',
		'grid-area','grid-gap','grid-row','grid-column'
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

				// detect group by matching prop in GROUPS (preserve order of GROUPS)
				for (const [groupName, props] of Object.entries(GROUPS)) {
					if (props.includes(decl.prop)) {
						currentGroup = groupName;
						break;
					}
				}

				// If this is the first declaration, don't insert an extra blank line:
				if (decl === firstDecl) {
					decl.raws.before = '\n\t'; // single tab right after selector
					lastGroup = currentGroup;
					return;
				}

				// If group changed, insert blank line + tab, otherwise only a tab
				if (currentGroup !== lastGroup) {
					decl.raws.before = '\n\n\t';
					lastGroup = currentGroup;
				} else
					decl.raws.before = '\n\t';
			});
		});
	}
});

module.exports.postcss = true;
