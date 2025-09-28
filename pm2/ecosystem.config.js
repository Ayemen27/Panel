
module.exports = {
  apps: [{
    name: 'panel-app',
    script: '/home/runner/workspace/server/index.ts',
    interpreter: 'tsx',
    watch: false,
    autorestart: true,
    max_restarts: 10,
    restart_delay: 3000,
    env: {
      NODE_ENV: 'development',
      PORT: '5000'
    },
    env_production: {
      NODE_ENV: 'production',
      PORT: '5000'
    },
    log_file: '/home/runner/workspace/logs/pm2-combined.log',
    out_file: '/home/runner/workspace/logs/pm2-out.log',
    error_file: '/home/runner/workspace/logs/pm2-error.log',
    pid_file: '/home/runner/workspace/pm2/pids/panel-app.pid'
  }]
};
