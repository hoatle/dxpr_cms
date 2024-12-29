<?php

declare(strict_types=1);

use Drupal\TestSite\TestSetupInterface;
use Drupal\user\Entity\User;

final class TestSite implements TestSetupInterface {

  /**
   * {@inheritdoc}
   */
  public function setup(): void {
    \Drupal::configFactory()
      ->getEditable('system.logging')
      ->set('error_level', ERROR_REPORTING_DISPLAY_VERBOSE)
      ->save();

    User::load(1)->setPassword('password')->save();

    // Ensure there is a user for each non-administrative role.
    $roles = \Drupal::entityTypeManager()
      ->getStorage('user_role')
      ->getQuery()
      ->condition('is_admin', FALSE)
      ->condition('id', [User::ANONYMOUS_ROLE, User::AUTHENTICATED_ROLE], 'NOT IN')
      ->execute();
    foreach ($roles as $role_id) {
      $account = User::create([
        'name' => $role_id,
        'pass' => 'password',
      ]);
      $account->addRole($role_id)->activate()->save();
    }
  }

}
