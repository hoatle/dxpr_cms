<?php

use Drupal\Core\DrupalKernel;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpKernel\HttpKernelInterface;
use Drupal\user\Entity\User;

// Ensure the autoloader is included
$autoloader = require_once __DIR__ . '/web/autoload.php';
// Ensure we are in the right directory
chdir(__DIR__ . '/web');
// Create the request object from globals
$request = Request::createFromGlobals();
// Initialize the Drupal kernel
$kernel = DrupalKernel::createFromRequest($request, $autoloader, 'prod');
// Boot the kernel
$kernel->boot();
// Ensure the container is correctly initialized
$container = $kernel->getContainer();

$user = User::load(1);
\Drupal::currentUser()->setAccount($user);
$path = '/admin/appearance/settings/dxpr_theme';
$request = Request::create($path, 'GET');
$response = $kernel->handle($request, HttpKernelInterface::SUB_REQUEST);

// Terminate the kernel (important for clean shutdown)
$kernel->terminate($request, $response);
