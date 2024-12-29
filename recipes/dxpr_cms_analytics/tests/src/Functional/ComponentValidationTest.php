<?php

declare(strict_types=1);

namespace Drupal\Tests\dxpr_cms_analytics\Functional;

use Drupal\FunctionalTests\Core\Recipe\RecipeTestTrait;
use Drupal\Tests\BrowserTestBase;

/**
 * @group dxpr_cms_analytics
 */
class ComponentValidationTest extends BrowserTestBase {

  use RecipeTestTrait;

  /**
   * {@inheritdoc}
   */
  protected $defaultTheme = 'stark';

  public function test(): void {
    $dir = realpath(__DIR__ . '/../../..');

    // This recipe always requires a valid-looking Google Tag ID.
    $options = [
      '--input=dxpr_cms_analytics.property_id=GTM-123456',
    ];
    // The recipe should apply cleanly.
    $this->applyRecipe($dir, options: $options);
    // Apply it twice to prove it is idempotent.
    $this->applyRecipe($dir, options: $options);

    // The recipe should fail if no input is provided.
    $this->assertStringContainsString('This value should not be blank.', $this->applyRecipe($dir, 1)->getErrorOutput());
    // It should also fail if an invalid tag ID is provided.
    $options = [
      '--input=dxpr_cms_analytics.property_id=nonsense',
    ];
    $this->assertStringContainsString('This value is not valid.', $this->applyRecipe($dir, 1, $options)->getErrorOutput());
  }

}
