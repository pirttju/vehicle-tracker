module.exports = {
  apps : [{
    name: 'vehicle-tracker',
    script: 'src/index.js',
    restart_delay: 3000,
    watch: false,
    env: {
      'NODE_ENV': 'production'
    },
    env_dev: {
      'NODE_ENV': 'development'
    }
  }]
};
