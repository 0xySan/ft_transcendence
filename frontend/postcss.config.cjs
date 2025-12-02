// postcss.config.cjs
const sorting = require("postcss-sorting");
const propertyOrder = require("./postcss-property-order.cjs");
const groupNewline = require("./postcss-group-newline.cjs");

module.exports = {
	plugins: [
		sorting({
			"order": [
				"custom-properties",
				"dollar-variables",
				"declarations",
				"rules",
				"at-rules"
			],
			"properties-order": propertyOrder,
			"unspecified-properties-position": "bottom"
		}),

		groupNewline()
	]
};
