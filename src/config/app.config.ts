import { registerAs } from '@nestjs/config';
import { LogLevel } from '../utils/validators/environment.validator';

export default registerAs('app', () => ({
  nodeEnv: process.env.NODE_ENV,
  name: process.env.APP_NAME,
  workingDirectory: process.env.PWD || process.cwd(),
  port: process.env.PORT,
  host: process.env.HOST,
  url: `${process.env.APP_IP}:${process.env.APP_PORT}` || '0.0.0.0:3000',
  logLevel: process.env.LOG_LEVEL || LogLevel.Log,
  logFile: process.env.LOG_FILE || 'app.log',
}));
