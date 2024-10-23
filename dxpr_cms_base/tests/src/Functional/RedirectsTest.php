<?php

declare(strict_types=1);

namespace Drupal\Tests\dxpr_cms\Functional;

use Drupal\Core\Test\AssertMailTrait;
use Drupal\FunctionalTests\Core\Recipe\RecipeTestTrait;
use Drupal\Tests\BrowserTestBase;
use Drupal\user\Entity\Role;
use Drupal\user\RoleInterface;

/**
 * @group dxpr_cms
 */
class RedirectsTest extends BrowserTestBase {

  use AssertMailTrait;
  use RecipeTestTrait;

  /**
   * {@inheritdoc}
   */
  protected $defaultTheme = 'stark';

  public function testRedirects(): void {
    $dir = realpath(__DIR__ . '/../../..');
    $this->applyRecipe($dir);

    $session = $this->getSession();
    $assert_session = $this->assertSession();

    // A 403 should redirect to the login page, forwarding to the original
    // destination.
    $this->drupalGet('/admin');
    $assert_session->addressEquals('/user/login');
    $this->assertStringContainsString('destination=/admin', parse_url($session->getCurrentUrl(), PHP_URL_QUERY));

    // Disable anti-spam protection, which prevents us from doing the password
    // reset or logging in without JavaScript.
    Role::load(RoleInterface::ANONYMOUS_ID)
      ->grantPermission('skip antibot')
      ->grantPermission('bypass honeypot protection')
      ->save();

    // Upon logging in, we should be redirected to the dashboard. And upon
    // logging out, we should be redirected back to the login page.
    // We need to avoid using one-time login links, as drupalLogin() adds
    // /user/1 to the destination.
    $this->drupalGet('/user/login');
    $this->submitForm([
      'name' => $this->rootUser->getAccountName(),
      'pass' => $this->rootUser->passRaw,
    ], 'Log in');
    $assert_session->addressEquals('/admin/dashboard');

    $this->drupalLogout();
    $assert_session->addressEquals('/user/login');

    // We shouldn't get any special redirection if we're resetting our password.
    $page = $session->getPage();
    $page->clickLink('Reset your password');
    $page->fillField('name', $this->rootUser->getAccountName());
    $page->pressButton('Submit');
    $mail = $this->getMails();
    $this->assertNotEmpty($mail);
    $this->assertSame('user_password_reset', $mail[0]['id']);
    $matches = [];
    preg_match('/^http.+/m', $mail[0]['body'], $matches);
    $this->drupalGet($matches[0]);
    $assert_session->addressMatches('|/user/reset/|');
    $uid = $this->rootUser->id();
    $page->pressButton('Log in');
    // But once we log in, we are redirected to the user's profile form, to
    // change the password.
    $assert_session->addressEquals("/user/$uid/edit");
  }

}
