const crypto = require('crypto');

module.exports = {
  genPassword: function() {
    return crypto.randomBytes(5).toString('hex');
  },
  genHash: function() {
    return crypto.randomBytes(20).toString('hex');
  },
  genExpDate: function(minutes = 60) {
    var dateObj = new Date();

    return dateObj.setMinutes(dateObj.getMinutes() + minutes);
  }
};
