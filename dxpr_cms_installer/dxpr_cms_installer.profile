<?php

declare(strict_types=1);

use Drupal\Component\Utility\Random;
use Drupal\Core\Extension\ModuleInstallerInterface;
use Drupal\Core\Installer\Form\SiteConfigureForm;
use Drupal\Core\Form\FormStateInterface;
use Drupal\Core\Recipe\InputCollector;
use Drupal\Core\Recipe\Recipe;
use Drupal\Core\Recipe\RecipeRunner;
use Drupal\dxpr_cms_installer\Form\RecipesForm;
use Drupal\dxpr_cms_installer\Form\SiteNameForm;
use Drupal\dxpr_cms_installer\Form\ConfigureAPIKeysForm;
use Symfony\Component\Process\ExecutableFinder;

/**
 * Implements hook_install_tasks().
 */
function dxpr_cms_installer_install_tasks(): array {
  return [
    'dxpr_cms_installer_module_keys' => [
      'display_name' => t('Enter API keys'),
       'type' => 'form',
       'function' => ConfigureAPIKeysForm::class,
    ],
    'dxpr_cms_uninstall_unused_ai_modules' => [
      // Uninstall the unused AI provider module.
    ],
    'dxpr_cms_installer_uninstall_myself' => [
      // As a final task, this profile should uninstall itself.
    ],
    'dxpr_cms_installer_rebuild_theme' => [
      // Rebuild theme CSS.
    ],
  ];
}

/**
 * Implements hook_install_tasks_alter().
 */
function dxpr_cms_installer_install_tasks_alter(array &$tasks, array $install_state): void {
  $insert_before = function (string $key, array $additions) use (&$tasks): void {
    $key = array_search($key, array_keys($tasks), TRUE);
    if ($key === FALSE) {
      return;
    }
    // This isn't very clean, but it's the only way to positionally splice into
    // an associative (and therefore by definition unordered) array.
    $tasks_before = array_slice($tasks, 0, $key, TRUE);
    $tasks_after = array_slice($tasks, $key, NULL, TRUE);
    $tasks = $tasks_before + $additions + $tasks_after;
  };
  $insert_before('install_settings_form', [
    'dxpr_cms_installer_choose_recipes' => [
      'display_name' => t('Choose add-ons'),
      'type' => 'form',
      'run' => array_key_exists('recipes', $install_state['parameters']) ? INSTALL_TASK_SKIP : INSTALL_TASK_RUN_IF_REACHED,
      'function' => RecipesForm::class,
    ],
    'dxpr_cms_installer_site_name_form' => [
      'display_name' => t('Name your site'),
      'type' => 'form',
      'run' => array_key_exists('site_name', $install_state['parameters']) ? INSTALL_TASK_SKIP : INSTALL_TASK_RUN_IF_REACHED,
      'function' => SiteNameForm::class,
    ],
  ]);

  // Set English as the default language; it can be changed mid-stream. We can't
  // use the passed-in $install_state because it's not passed by reference.
  $GLOBALS['install_state']['parameters'] += ['langcode' => 'en'];

  // Submit the site configuration form programmatically.
  $tasks['install_configure_form'] = [
    'function' => 'dxpr_cms_installer_configure_site',
  ];

  // Wrap the install_profile_modules() function, which returns a batch job, and
  // add all the necessary operations to apply the chosen template recipe.
  $tasks['install_profile_modules']['function'] = 'dxpr_cms_installer_apply_recipes';
}

/**
 * Implements hook_form_alter() for install_settings_form.
 *
 * @see \Drupal\Core\Installer\Form\SiteSettingsForm
 */
function dxpr_cms_installer_form_install_settings_form_alter(array &$form): void {
  // Default to SQLite, if available, because it doesn't require any additional
  // configuration.
  $sqlite = 'Drupal\sqlite\Driver\Database\sqlite';
  if (array_key_exists($sqlite, $form['driver']['#options']) && extension_loaded('pdo_sqlite')) {
    $form['driver']['#default_value'] = $sqlite;
  }
}

/**
 * Runs a batch job that applies the template and add-on recipes.
 *
 * @param array $install_state
 *   An array of information about the current installation state.
 *
 * @return array
 *   The batch job definition.
 */
function dxpr_cms_installer_apply_recipes(array &$install_state): array {
  $batch = install_profile_modules($install_state);
  $batch['title'] = t('Setting up your site');

  // If we're installing for the trial, install the dxpr_cms_trial module.
  if (getenv('DXPR_CMS_TRIAL')) {
    $batch['operations'][] = ['_install_module_batch', ['dxpr_cms_trial', t('Trial experience module')]];
  }

  $cookbook_path = \Drupal::root() . '/recipes';

  foreach ($install_state['parameters']['recipes'] as $recipe) {
    $recipe = Recipe::createFromDirectory($cookbook_path . '/' . $recipe);

    foreach (RecipeRunner::toBatchOperations($recipe) as $operation) {
      $batch['operations'][] = $operation;
    }
  }
  return $batch;
}

/**
 * Programmatically executes core's site configuration form.
 */
function dxpr_cms_installer_configure_site(array &$install_state): ?array {
  $random_password = (new Random())->machineName();
  $host = \Drupal::request()->getHost();

  $install_state['forms'] += [
    'install_configure_form' => [
      'site_name' => $install_state['parameters']['site_name'],
      'site_mail' => "no-reply@$host",
      'account' => [
        'name' => 'admin',
        'mail' => "admin@$host",
        'pass' => [
          'pass1' => $random_password,
          'pass2' => $random_password,
        ],
      ],
    ],
  ];
  // Temporarily switch to non-interactive mode and programmatically submit
  // the form.
  $interactive = $install_state['interactive'];
  $install_state['interactive'] = FALSE;
  $result = install_get_form(SiteConfigureForm::class, $install_state);
  $install_state['interactive'] = $interactive;

  $messenger = \Drupal::messenger();
  // Clear all previous status messages to avoid clutter.
  $messenger->deleteByType($messenger::TYPE_STATUS);

  $message = t('Make a note of your login details to access your site later:<br />Username: admin<br />Password: @password', [
    '@password' => $install_state['forms']['install_configure_form']['account']['pass']['pass1'],
  ]);
  $messenger->addStatus($message);

  return $result;
}

/**
 * Implements hook_library_info_alter().
 */
function dxpr_cms_installer_library_info_alter(array &$libraries, string $extension): void {
  $base_path = _dxpr_cms_installer_base_path();

  if ($extension === 'claro') {
    $libraries['maintenance-page']['css']['theme']["$base_path/css/gin-variables.css"] = [];
    $libraries['maintenance-page']['css']['theme']["$base_path/css/fonts.css"] = [];
    $libraries['maintenance-page']['css']['theme']["$base_path/css/installer-styles.css"] = [];
    $libraries['maintenance-page']['css']['theme']["$base_path/css/add-ons.css"] = [];
    $libraries['maintenance-page']['css']['theme']["$base_path/css/language-dropdown.css"] = [];
    $libraries['maintenance-page']['js']["$base_path/js/language-dropdown.js"] = [];
    $libraries['maintenance-page']['dependencies'][] = 'core/once';
  }
  if ($extension === 'core') {
    $libraries['drupal.progress']['js']["$base_path/js/progress.js"] = [];
  }
}

/**
 * Makes configuration changes needed for the in-browser trial.
 */
function dxpr_cms_installer_prepare_trial(): void {
  // Use a test mail collector, since the trial won't have access to sendmail.
  \Drupal::configFactory()
    ->getEditable('system.mail')
    ->set('interface.default', 'test_mail_collector')
    ->save();

  // Disable CSS and JS aggregation.
  \Drupal::configFactory()
    ->getEditable('system.performance')
    ->set('css.preprocess', FALSE)
    ->set('js.preprocess', FALSE)
    ->save();

  // Enable verbose logging.
  \Drupal::configFactory()
    ->getEditable('system.logging')
    ->set('error_level', 'verbose')
    ->save();

  // Disable things that the WebAssembly runtime doesn't (yet) support, like
  // running external processes or making HTTP requests.
  // @todo revisit once php-wasm maps HTTP requests from PHP to Fetch API.
  \Drupal::service(ModuleInstallerInterface::class)->uninstall([
    'automatic_updates',
    'update',
  ]);
  \Drupal::configFactory()
    ->getEditable('project_browser.admin_settings')
    ->set('allow_ui_install', FALSE)
    ->save();
}

/**
 * Uninstalls the unused AI provider module.
 */
function dxpr_cms_uninstall_unused_ai_modules(): void {
  $providers = ['anthropic', 'openai'];
  $provider_plugin = \Drupal::service('ai.provider');
  $unusable_providers = [];
  foreach ($providers as $provider) {
    // Create an instance and check if its usable (setup).
    $plugin = $provider_plugin->createInstance($provider);
    if (!$plugin->isUsable()) {
      $unusable_providers[] = $plugin;
    }
  }

  // If one of the providers worked, uninstall the unused one(s), but if all
  // failed, don't do anything.
  if (count($unusable_providers) < count($providers)) {
    foreach ($unusable_providers as $plugin) {
      \Drupal::service(ModuleInstallerInterface::class)->uninstall([
        $plugin->getModuleDataName(),
      ]);
    }
  }
}

/**
 * Uninstalls this install profile, as a final step.
 */
function dxpr_cms_installer_uninstall_myself(): void {
  \Drupal::service(ModuleInstallerInterface::class)->uninstall([
    'dxpr_cms_installer',
  ]);
}

/**
 * Rebuild theme CSS.
 */
function dxpr_cms_installer_rebuild_theme(): void {
  require_once \Drupal::service('extension.list.theme')->getPath('dxpr_theme') . '/dxpr_theme_callbacks.inc';
  dxpr_theme_css_cache_build('dxpr_theme');
}

/**
 * Implements hook_theme_registry_alter().
 */
function dxpr_cms_installer_theme_registry_alter(array &$hooks): void {
  global $install_state;
  $installer_path = $install_state['profiles']['dxpr_cms_installer']->getPath();

  $hooks['install_page']['path'] = $installer_path . '/templates';
}

/**
 * Preprocess function for all pages in the installer.
 */
function dxpr_cms_installer_preprocess_install_page(array &$variables): void {
  // Don't show the task list or the version of Drupal.
  unset($variables['page']['sidebar_first'], $variables['site_version']);

  $variables['images_path'] = _dxpr_cms_installer_base_path() . '/images';
}

/**
 * Returns the base URL path of the DXPR CMS installer.
 *
 * @return string
 *   The installer's base URL path, e.g. `/profiles/dxpr_cms_installer`.
 */
function _dxpr_cms_installer_base_path(): string {
  // We're in the installer, which is `/core/install.php`, so $base_path will
  // probably be `/core`. Therefore, we call `dirname()` to trim that off.
  $base_path = \Drupal::request()->getBasePath();
  $base_path = dirname($base_path);

  global $install_state;
  return $base_path . $install_state['profiles']['dxpr_cms_installer']->getPath();
}
