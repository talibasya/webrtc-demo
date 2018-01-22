const db_name = "semgregate"

const env =  {
  BASE_HREF: 'http://localhost:8701',
  HTTP_PORT: 8181
}

const env_production = {
  ...env,
  BASE_HREF: 'http://comm.xaos.ninja',
  HTTP_PORT: 8004
}

module.exports = {
  /**
   * Application configuration section
   * http://pm2.keymetrics.io/docs/usage/application-declaration/
   */
  apps : [

    {
      name      : 'server',
      script    : 'index.js',
      cwd       : 'server',
      env,
      env_production
    }

  ],

  /**
   * Deployment section
   * http://pm2.keymetrics.io/docs/usage/deployment/
   */
  deploy : {
    production : {
      user : 'root',
      host : 'comm-xaos.default.svc.cluster.local',
      ref  : 'origin/master',
      repo : 'git@bitbucket.org:MLaszczewski/webrtc-demo.git',
      path : '/root',
      'post-deploy' : './compile.sh && pm2 reload ecosystem.config.js --env production',
      env  : {
        NODE_ENV: 'dev'
      }
    }
  }
};
