// postcss-property-order.cjs
const GROUPS = require('./postcss-group-newline.cjs').GROUPS;

module.exports = Object.values(GROUPS).flat();
