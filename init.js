const { exec } = require('child_process');
const sequelizeMigration = new Promise((resolve, reject) => {
  const migrate = exec(
    'sequelize db:migrate',
    { env: process.env },
    (err, stdout, stderr) => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    }
  );

  // Forward stdout+stderr to this process
  migrate.stdout.pipe(process.stdout);
  migrate.stderr.pipe(process.stderr);
});

sequelizeMigration.then(() => {
  const Models = require('./models');

  Models.Setting.findOrCreate({ where: {} });
});
