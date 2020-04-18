const Models = require('../models');

module.exports = router => {
  require('./post')(Models, router);
  require('./tag')(Models, router);
  require('./user')(Models, router);
  require('./setting')(Models, router);
};
