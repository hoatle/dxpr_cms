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
  }

}
