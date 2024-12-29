<?php

declare(strict_types=1);

namespace Drupal\Tests\dxpr_cms_page\Functional;

use Drupal\FunctionalTests\Core\Recipe\RecipeTestTrait;
use Drupal\Tests\BrowserTestBase;

/**
 * @group dxpr_cms_page
 */
class ComponentValidationTest extends BrowserTestBase {

  use RecipeTestTrait;

  /**
   * {@inheritdoc}
   */
  protected $defaultTheme = 'stark';

  /**
   * {@inheritdoc}
   */
  protected function setUp(): void {
    parent::setUp();

    $dir = realpath(__DIR__ . '/../../..');
    // The recipe should apply cleanly.
    $this->applyRecipe($dir);
    // Apply it again to prove that it is idempotent.
    $this->applyRecipe($dir);
  }

  public function testPathAliasPatternPrecedence(): void {
    $dir = realpath(__DIR__ . '/../../../../dxpr_cms_seo_basic');
    $this->applyRecipe($dir);

    // Confirm that pages have the expected path aliases.
    $node = $this->drupalCreateNode([
      'type' => 'page',
      'title' => 'Test page',
    ]);
    $this->assertStringEndsWith('/test-page', $node->toUrl()->toString());
  }

}
