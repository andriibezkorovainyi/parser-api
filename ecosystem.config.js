const dotenv = require('dotenv');
dotenv.config();

// PM2 ecosystem config
module.exports = {
  apps: [
    {
      name: 'worker-eth-1',
      script: './dist/parser-main.js',
      instances: 1,
      env: {
        ...process.env,
        INSTANCE_ID: 1,
        NETWORK: 'ETH',
        LOG_FILE: './log/worker-eth-1.log',
        NODE_ENV: 'production',
      },
    },
    {
      name: 'worker-eth-2',
      script: './dist/parser-main.js',
      instances: 1,
      env: {
        ...process.env,
        INSTANCE_ID: 2,
        NETWORK: 'ETH',
        LOG_FILE: './log/worker-eth-2.log',
        NODE_ENV: 'production',
      },
    },
  ],
};
