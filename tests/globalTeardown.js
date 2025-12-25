const database = require('../server/utils/database');

module.exports = async () => {
  // Close all database connections
  await database.close();
  console.log('Closed test database connections');
};
