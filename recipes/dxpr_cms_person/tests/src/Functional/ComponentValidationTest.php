<?php

declare(strict_types=1);

namespace Drupal\Tests\dxpr_cms_person\Functional;

use Drupal\Core\Field\FieldStorageDefinitionInterface;
use Drupal\FunctionalTests\Core\Recipe\RecipeTestTrait;
use Drupal\Tests\BrowserTestBase;
use Drupal\Tests\dxpr_cms_content_type_base\ContentModelTestTrait;

/**
 * @group dxpr_cms_person
 */
class ComponentValidationTest extends BrowserTestBase {

  use ContentModelTestTrait;
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

  public function testContentModel(): void {
    $this->assertContentModel([
      'person' => [
        'title' => [
          'type' => 'string',
          'cardinality' => 1,
          'required' => TRUE,
          'translatable' => TRUE,
          'label' => 'Name',
          'input type' => 'text',
          'help text' => '',
        ],
        'field_description' => [
          'type' => 'string_long',
          'cardinality' => 1,
          'required' => TRUE,
          'translatable' => TRUE,
          'label' => 'Description',
          'input type' => 'textarea',
          'help text' => 'Describe the page content. This appears as the description in search engine results.',
        ],
        'field_person__role_job_title' => [
          'type' => 'string_long',
          'cardinality' => 1,
          'required' => FALSE,
          'translatable' => TRUE,
          'label' => 'Role or job title',
          'input type' => 'textarea',
          'help text' => 'Include a role or job title.',
        ],
        'field_person__email' => [
          'type' => 'email',
          'cardinality' => 5,
          'required' => FALSE,
          'translatable' => FALSE,
          'label' => 'Email',
          'input type' => 'email',
          'help text' => 'Include up to 5 email addresses.',
        ],
        'field_person__phone_number' => [
          'type' => 'telephone',
          'cardinality' => 5,
          'required' => FALSE,
          'translatable' => FALSE,
          'label' => 'Phone number',
          'input type' => 'tel',
          'help text' => 'Include up to 5 phone numbers.',
        ],
        'field_featured_image' => [
          'type' => 'entity_reference',
          'cardinality' => 1,
          'required' => FALSE,
          'translatable' => FALSE,
          'label' => 'Featured image',
          'input type' => 'media library',
          'help text' => 'Include an image. This appears as the image in search engine results.',
        ],
        'body' => [
          'type' => 'text_with_summary',
          'cardinality' => 1,
          'required' => FALSE,
          'translatable' => TRUE,
          'label' => 'Biography',
          'input type' => 'wysiwyg',
          'help text' => '',
        ],
        'field_tags' => [
          'type' => 'entity_reference',
          'cardinality' => FieldStorageDefinitionInterface::CARDINALITY_UNLIMITED,
          'required' => FALSE,
          'translatable' => FALSE,
          'label' => 'Tags',
          'input type' => 'text',
          'help text' => 'Include tags for relevant topics.',
        ],
      ],
    ]);
  }

  public function testPathAliasPatternPrecedence(): void {
    $dir = realpath(__DIR__ . '/../../../../dxpr_cms_seo_basic');
    $this->applyRecipe($dir);

    // Confirm that person profiles have the expected path aliases.
    $node = $this->drupalCreateNode([
      'type' => 'person',
      'title' => 'Test Person profile',
    ]);
    $this->assertStringEndsWith("/profiles/test-person-profile", $node->toUrl()->toString());
  }

}
