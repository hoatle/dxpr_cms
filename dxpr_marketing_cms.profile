<?php

/**
 * @file
 * Enables modules and site configuration for a dxpr_marketing_cms site installation.
 */

use Drupal\contact\Entity\ContactForm;
use Drupal\Core\Form\FormStateInterface;

/**
 * Implements hook_form_FORM_ID_alter() for install_configure_form().
 *
 * Allows the profile to alter the site configuration form.
 */
// function dxpr_marketing_cms_form_install_configure_form_alter(&$form, FormStateInterface $form_state) {
//   $form['#submit'][] = 'dxpr_marketing_cms_form_install_configure_submit';
// }

/**
 * Submission handler to sync the contact.form.feedback recipient.
 */
// function dxpr_marketing_cms_form_install_configure_submit($form, FormStateInterface $form_state) {
//   $site_mail = $form_state->getValue('site_mail');
//   ContactForm::load('feedback')->setRecipients([$site_mail])->trustData()->save();
// }

/**
 * Implements hook_install_tasks().
 */
function dxpr_marketing_cms_install_tasks(&$install_state) {

  $tasks = [
    'dxpr_marketing_cms_module_install' => [
      'display_name' => t('Install demo content'),
      'type' => 'batch',
    ],
  ];

  return $tasks;
}

/**
 * Installs the CMS modules in a batch.
 *
 * @param array $install_state
 *   The install state.
 *
 * @return array
 *   A batch array to execute.
 */
function dxpr_marketing_cms_module_install(array &$install_state) {
  // Installed separately here so that it can detect and connect any pre-
  // installed media browsers
  Drupal::service('module_installer')->install(['dxpr_builder_media'], TRUE);
  // Drupal::service('module_installer')->install(['dxpr_builder_page'], TRUE);
  Drupal::service('module_installer')->install(['dxpr_builder_block'], TRUE);

  $batch = [];
  $operations = [];
  $modules = [
    'default_content',
    'dxpr_marketing_cms_demo_content',
    'gin_toolbar', // will complain about gin not being admin theme during install-time
  ];

  foreach ($modules as $module) {
    $operations[] = ['dxpr_marketing_cms_install_module_batch', [$module]];
  }
  $operations[] = ['dxpr_marketing_cms_cleanup_batch', ['default_content']];
  $operations[] = ['dxpr_marketing_cms_cleanup_batch', ['dxpr_marketing_cms_demo_content']];

  $batch = [
    'operations' => $operations,
    'title' => t('Installing additional modules'),
    'error_message' => t('The installation has encountered an error.'),
  ];
  return $batch;
}

/**
 * Implements callback_batch_operation().
 *
 * Performs batch installation of modules.
 */
function dxpr_marketing_cms_install_module_batch($module, &$context) {
  // CMS Modules are not available yet.
  Drupal::service('module_installer')->install([$module], TRUE);
  $context['results'][] = $module;
  $context['message'] = t('Installed %module_name module.', ['%module_name' => $module]);
}

/**
 * Implements callback_batch_operation().
 */
function dxpr_marketing_cms_cleanup_batch($module, &$context) {
  Drupal::service('module_installer')->uninstall(['default_content'], FALSE);

  $context['message'] = t('Cleanup.');
}