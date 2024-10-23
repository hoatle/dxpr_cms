/**
 * @file
 * Contains support code for end-to-end tests.
 */

import '@testing-library/cypress/add-commands';

const drupalMessages = '[data-drupal-messages]';

const runCommand = (command) => {
  const { env, workingDir, user } = Cypress.env('execOptions') || {};

  if (user) {
    command = `sudo -u ${user} ${command}`;
  }
  if (workingDir) {
    command = `cd ${workingDir} && ${command}`;
  }

  return cy.exec(command, {
    env: env || {},
  });
};

Cypress.Commands.add('applyRecipe', (path) => {
  path ??= Cypress.spec.absolute.split('/').slice(0, -3).join('/');

  Cypress.log({
    name: 'applyRecipe',
    displayName: 'recipe',
    message: 'Apply recipe',
    consoleProps() {
      return { path: path };
    },
  });
  runCommand(`php core/scripts/drupal recipe ${path}`);
});

Cypress.Commands.add('setUp', (installProfile) => {
  let command = `php core/scripts/test-site.php install --json`;
  if (installProfile) {
    command += ` --install-profile=${installProfile}`;
  }

  const setupFile = Cypress.env('testSiteSetupFile');
  if (setupFile) {
    command += ` --setup-file=${setupFile}`;
  }

  const initSession = () => {
    Cypress.log({
      name: 'installDrupal',
      displayName: 'install',
      message: `Install Drupal from ${installProfile || 'default'} profile`,
    });

    runCommand(command).then((result) => {
      const { db_prefix, user_agent, site_path } = JSON.parse(result.stdout);

      // We'll need this in the `tearDown` command.
      Cypress.env('dbPrefix', db_prefix);

      // Ensure that commands which get the site path from the
      // DRUPAL_DEV_SITE_PATH environment variable use the test site's path.
      const execOptions = Cypress.env('execOptions') || {};
      if ('env' in execOptions) {
        assert(typeof execOptions.env === 'object');
        execOptions.env['DRUPAL_DEV_SITE_PATH'] = site_path;
        Cypress.env('execOptions', execOptions);
      }

      // Set a cookie to ensure that visits to the test site will be directed to
      // a version of the site running in a test database.
      cy.setCookie('SIMPLETEST_USER_AGENT', encodeURIComponent(user_agent), {
        domain: new URL(Cypress.config('baseUrl')).host,
        path: '/',
      });
    });
  };
  cy.session(installProfile || 'testSite', initSession, {
    validate () {
      cy.getCookie('SIMPLETEST_USER_AGENT').should('not.be.empty');
    },
  });
});

/**
 * Destroys the test site that was created by `setUp()`.
 */
Cypress.Commands.add('tearDown', () => {
  const dbPrefix = Cypress.env('dbPrefix');
  expect(dbPrefix).to.not.be.empty;

  runCommand(`php core/scripts/test-site.php tear-down ${dbPrefix}`);
});

/**
 * Logs in as a specific user, identified by their username.
 */
Cypress.Commands.add('drupalLogin', (name) => {
  Cypress.log({
    name: 'drupalLogin',
    displayName: 'login',
    message: `Logging in as ${name}`,
  });
  cy.visit('/user/login');
  cy.findByLabelText('Username').type(name);
  cy.findByLabelText('Password').type('password');
  cy.findByDisplayValue('Log in').click();
  cy.get('.page-title').should('contain.text', name);
});

/**
 * Logs the current user out.
 */
Cypress.Commands.add('drupalLogout', () => {
  cy.visit('/user/logout');
  cy.findByDisplayValue('Log out').click();
});

/**
 * Creates a user account with a specific name and optional set of roles.
 */
Cypress.Commands.add('drupalCreateUser', (name, roles = []) => {
  cy.visit('/admin/people/create');

  cy.findByLabelText('Email address').type(`${name}@cypress.local`);
  cy.findByLabelText('Username').type(name);
  cy.findByLabelText('Password').type('password');
  cy.findByLabelText('Confirm password').type('password');
  cy.get('input[name^="roles["]').check(roles);
  cy.findByDisplayValue('Create new account').click();
  cy.get(drupalMessages).should('contain.text', `Created a new user account for ${name}.`);
});
