// PM2 ecosystem config
module.exports = {
  apps: [
    {
      name: 'worker',
      script: './dist/parser-main.js',
      instances: 1,
      exec_mode: 'cluster',
      env: {
        // ... APi_KEY
        // Chain
        LOG_FILE: '/var/log/parser-api/worker1.log',
        DATABASE_TYPE: 'postgres',
        DATABASE_HOST: '127.0.0.1',
        DATABASE_PORT: 5432,
        DATABASE_USERNAME: 'postgres',
        DATABASE_PASSWORD: '778977',
        DATABASE_NAME: 'parser_api',
        DATABASE_SYNCHRONIZE: false,
        DATABASE_LOGGING: true,
        DATABASE_MAX_CONNECTIONS: 100,
        DATABASE_SSL_ENABLED: false,
        DATABASE_REJECT_UNAUTHORIZED: false,
        INSTANCE_ID: 1,
      },
    },
  ],
};
