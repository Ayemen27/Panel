
{
  "apps": [
    {
      "name": "app2",
      "script": "./dist/index.js", 
      "cwd": "/home/runner/workspace/app2",
      "env": {
        "NODE_ENV": "production",
        "PORT": "3000",
        "DOMAIN": "app2.binarjoinanelytic.info"
      },
      "instances": 1,
      "exec_mode": "fork",
      "watch": false,
      "max_memory_restart": "1G",
      "error_file": "/home/runner/workspace/logs/app2-err.log",
      "out_file": "/home/runner/workspace/logs/app2-out.log", 
      "log_file": "/home/runner/workspace/logs/app2-combined.log",
      "time": true
    },
    {
      "name": "bot-v4",
      "script": "./dist/index.js",
      "cwd": "/home/runner/workspace/Bot.v4",
      "env": {
        "NODE_ENV": "production",
        "PORT": "5000",
        "DOMAIN": "binarjoinanelytic.info"
      },
      "instances": 1,
      "exec_mode": "fork",
      "watch": false,
      "max_memory_restart": "512M",
      "error_file": "/home/runner/workspace/logs/bot-err.log",
      "out_file": "/home/runner/workspace/logs/bot-out.log",
      "log_file": "/home/runner/workspace/logs/bot-combined.log",
      "time": true
    }
  ]
}
