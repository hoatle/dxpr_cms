const { defineConfig } = require("cypress");
const path = require('node:path');

const {
  DDEV_DOCROOT,
  DDEV_PRIMARY_URL,
  SIMPLETEST_DB,
  WEB_SERVER_USER,
} = process.env;

module.exports = defineConfig({
  e2e: {
    baseUrl: DDEV_PRIMARY_URL,
    specPattern: path.join('recipes', '**', '*.cy.js'),
    supportFile: 'e2e.js',
  },
  env: {
    execOptions: {
      env: {
        SIMPLETEST_BASE_URL: DDEV_PRIMARY_URL,
        SIMPLETEST_DB: SIMPLETEST_DB,
      },
      workingDir: DDEV_DOCROOT,
      user: WEB_SERVER_USER,
    },
    testSiteSetupFile: path.join(__dirname, 'TestSite.php'),
  }
});
