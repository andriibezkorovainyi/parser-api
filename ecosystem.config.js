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
      },
    },
  ],
};
