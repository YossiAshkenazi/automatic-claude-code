// PM2 Ecosystem Configuration for Automatic Claude Code
const path = require('path');

// Base directory is two levels up from config/production/
const baseDir = path.resolve(__dirname, '../../');

module.exports = {
  apps: [
    {
      name: 'acc-monitoring',
      script: path.join(baseDir, 'config/monitoring/monitoring-server.js'),
      cwd: baseDir,
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      max_memory_restart: '200M',
      env: {
        NODE_ENV: 'production',
        PORT: 6007
      },
      error_file: path.join(baseDir, 'logs/monitoring-error.log'),
      out_file: path.join(baseDir, 'logs/monitoring-out.log'),
      log_file: path.join(baseDir, 'logs/monitoring.log'),
      time: true,
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
      restart_delay: 5000,
      kill_timeout: 5000
    }
  ]
};