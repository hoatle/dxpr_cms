<?php

declare(strict_types=1);

namespace Drupal\dxpr_cms_trial;

use GuzzleHttp\Promise\FulfilledPromise;
use GuzzleHttp\Promise\PromiseInterface;
use GuzzleHttp\Psr7\Response;
use Psr\Http\Message\RequestInterface;

/**
 * Currently PHP in WebAssembly does not support outgoing HTTP requests.
 *
 * This HTTP client middleware is used to intercept outgoing HTTP requests so
 * that they do not fail.
 */
final class OutgoingHttpInterceptor {

  public function __invoke(): callable {
    return static function (callable $handler): callable {
      return static function (RequestInterface $request, array $options) use ($handler): PromiseInterface {
        if ((string) $request->getUri() === 'https://oembed.com/providers.json') {
          $response = file_get_contents(
            __DIR__ . '/../oembed-providers.json'
          );
          return new FulfilledPromise(new Response(200, ['Content-Type' => 'application/json'], $response));
        }
        if ((string) $request->getUri() === 'https://www.youtube.com/oembed?url=https%3A//www.youtube.com/watch%3Fv%3D21X5lGlDOfg') {
          $response = file_get_contents(
            __DIR__ . '/../youtube-oembed.json'
          );
          return new FulfilledPromise(new Response(200, ['Content-Type' => 'application/json'], $response));
        }
        throw new \RuntimeException('Request URI not mocked: ' . $request->getUri());
        return $handler($request, $options);
      };
    };
  }

}
