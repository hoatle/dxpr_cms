<?php

declare(strict_types=1);

namespace Drupal\Tests\dxpr_cms_blog\Functional;

use Drupal\FunctionalTests\Core\Recipe\RecipeTestTrait;
use Drupal\Tests\BrowserTestBase;

/**
 * @group dxpr_cms_blog
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

    // Confirm that blog posts have the expected path aliases.
    $node = $this->drupalCreateNode([
      'type' => 'blog',
      'title' => 'Test Blog',
    ]);
    $now = date('Y-m');
    $this->assertStringEndsWith("/blog/$now/test-blog", $node->toUrl()->toString());
  }

}
