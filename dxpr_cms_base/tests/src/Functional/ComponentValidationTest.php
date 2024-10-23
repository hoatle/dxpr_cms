<?php

declare(strict_types=1);

namespace Drupal\Tests\dxpr_cms\Functional;

use Drupal\FunctionalTests\Core\Recipe\RecipeTestTrait;
use Drupal\Tests\BrowserTestBase;

/**
 * @group dxpr_cms
 */
class ComponentValidationTest extends BrowserTestBase {

  use RecipeTestTrait {
    applyRecipe as traitApplyRecipe;
  }

  /**
   * {@inheritdoc}
   */
  protected $defaultTheme = 'stark';

  private function applyRecipe(string $path): void {
    // The recipe should apply cleanly.
    $this->traitApplyRecipe($path);
    // Apply it again to prove that it is idempotent.
    $this->traitApplyRecipe($path);
  }

  public function test(): void {
    // Apply this recipe.
    $dir = realpath(__DIR__ . '/../../..');
    $this->applyRecipe($dir);

    // Read our `composer.json` file to get the list of optional recipes.
    $composer = file_get_contents($dir . '/composer.json');
    $composer = json_decode($composer, TRUE, flags: JSON_THROW_ON_ERROR);

    // Test that all the optional recipes can be applied on top of this recipe,
    // two times each.
    $cookbook_dir = dirname($dir);
    $optional_recipes = array_map(
      fn ($name) => $cookbook_dir . '/' . basename($name),
      array_keys($composer['suggest'] ?? []),
    );
    array_walk($optional_recipes, $this->applyRecipe(...));

    // The navigation should have a link to the dashboard.
    $this->drupalLogin($this->rootUser);
    $this->assertSession()
      ->elementAttributeContains('named', ['link', 'Dashboard'], 'class', 'toolbar-button--icon--navigation-dashboard');
  }

}
