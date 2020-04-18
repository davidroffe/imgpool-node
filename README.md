# imgpool

Simple headless image board server built on Koa

[![node](https://img.shields.io/badge/node-%3E%3D%208.10.0-brightgreen)](https://github.com/nodejs/node)
[![postgres](https://img.shields.io/badge/postgres-%3E%3D%2010.10.0-blue)](https://github.com/postgres/postgres)

### Prerequisites

- Node >= 8.10.0
- PostgreSQL >= 10.10.0

### Installing

Modify the config.example.json & .env.example files with the relevant information and remove the .example portion of the file names. Make a config directory in the root directory and place the config.json in it.

```bash
# install packages
$ yarn

# run init script
$ yarn run init

# run build script
$ yarn run build

# run the app
$ yarn run app
```

## License

This project is licensed under the GPLv3 License - see the [LICENSE](https://github.com/davidroffe/imgpool/blob/master/LICENSE) file for details
