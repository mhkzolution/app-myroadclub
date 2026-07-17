<?php
/**
 * Lightweight contract tests for namespace-scoped CORS.
 */

declare(strict_types=1);

final class WP_REST_Request {
	private string $route;
	private string $origin;

	public function __construct(string $route, string $origin) {
		$this->route  = $route;
		$this->origin = $origin;
	}

	public function get_route(): string {
		return $this->route;
	}

	public function get_header(string $name): string {
		return 'origin' === strtolower($name) ? $this->origin : '';
	}
}

function assert_same($expected, $actual, string $message): void {
	if ($expected !== $actual) {
		fwrite(
			STDERR,
			"FAIL: {$message}\n  expected: " . var_export($expected, true) .
			"\n  actual: " . var_export($actual, true) . "\n"
		);
		exit(1);
	}
}

define('MRC_REQUESTS_DEV_ORIGIN', 'http://localhost:3000');

$cors_file = dirname(__DIR__) . '/includes/class-mrc-request-cors.php';
if (!file_exists($cors_file)) {
	fwrite(STDERR, "FAIL: request CORS class does not exist\n");
	exit(1);
}
require_once $cors_file;

$production = MRC_Request_CORS::headers_for_request(
	new WP_REST_Request('/myroadclub/v1/ticket-requests', 'https://app.myroadclub.com')
);
assert_same('https://app.myroadclub.com', $production['Access-Control-Allow-Origin'], 'production origin is reflected exactly');
assert_same('Origin', $production['Vary'], 'allowed response varies by origin');
assert_same('Authorization, Content-Type', $production['Access-Control-Allow-Headers'], 'authorization and content type are allowed');
assert_same('GET, PATCH, POST, OPTIONS', $production['Access-Control-Allow-Methods'], 'preflight methods are allowed');

$development = MRC_Request_CORS::headers_for_request(
	new WP_REST_Request('/myroadclub/v1/roadside-requests', 'http://localhost:3000')
);
assert_same('http://localhost:3000', $development['Access-Control-Allow-Origin'], 'configured development origin is allowed');

$disallowed = MRC_Request_CORS::headers_for_request(
	new WP_REST_Request('/myroadclub/v1/ticket-requests', 'https://evil.example')
);
assert_same(array(), $disallowed, 'disallowed namespace origin receives no CORS headers');

$outside_namespace = MRC_Request_CORS::headers_for_request(
	new WP_REST_Request('/wp/v2/posts', 'https://app.myroadclub.com')
);
assert_same(null, $outside_namespace, 'routes outside the plugin namespace are untouched');

$remove_plan = MRC_Request_CORS::headers_to_remove();
assert_same(
	array(
		'Access-Control-Allow-Origin',
		'Access-Control-Allow-Headers',
		'Access-Control-Allow-Methods',
		'Access-Control-Allow-Credentials',
	),
	$remove_plan,
	'namespace responses strip core CORS allow headers including credentials'
);

echo "CORS tests passed.\n";
