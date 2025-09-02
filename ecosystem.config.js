// PM2 Ecosystem Configuration for Automatic Claude Code
module.exports = {
  apps: [
    {
      name: 'acc-monitoring',
      script: 'monitoring-server.js',
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      max_memory_restart: '200M',
      env: {
        NODE_ENV: 'production',
        PORT: 4005
      },
      error_file: './logs/monitoring-error.log',
      out_file: './logs/monitoring-out.log',
      log_file: './logs/monitoring.log',
      time: true,
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
      restart_delay: 5000,
      kill_timeout: 5000
    }
  ]
};