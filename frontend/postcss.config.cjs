// postcss.config.cjs
const sort = require('postcss-sorting');
const groupNewline = require('./postcss-group-newline.cjs');

module.exports = {
	plugins: [
		sort({
			order: [
				"custom-properties",
				"dollar-variables",
				"declarations",
				"rules",
				"at-rules"
			],
			unspecifiedPropertiesPosition: "bottom"
		}),
		groupNewline()
	]
};
