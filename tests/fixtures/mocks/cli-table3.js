// Mock for cli-table3 module
const Table = function(options) {
  this.options = options || {};
  this.rows = [];
  
  this.push = function(...rows) {
    this.rows.push(...rows);
  };
  
  this.toString = function() {
    return this.rows.map(row => Array.isArray(row) ? row.join(' | ') : String(row)).join('\n');
  };
  
  return this;
};

module.exports = Table;
module.exports.default = Table;
