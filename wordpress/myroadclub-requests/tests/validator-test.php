<?php
/**
 * Lightweight contract tests for MRC_Request_Validator.
 * Runs without WordPress; provides a minimal WP_Error stand-in.
 */

declare(strict_types=1);

if (!class_exists('WP_Error')) {
	class WP_Error {
		/** @var string */
		public $code;
		/** @var string */
		public $message;
		/** @var array */
		public $data;

		public function __construct(string $code = '', string $message = '', $data = '') {
			$this->code = $code;
			$this->message = $message;
			$this->data = is_array($data) ? $data : array();
		}

		public function get_error_code(): string {
			return $this->code;
		}

		public function get_error_message(): string {
			return $this->message;
		}

		public function get_error_data() {
			return $this->data;
		}
	}
}

function assert_true(bool $condition, string $message): void {
	if (!$condition) {
		fwrite(STDERR, "FAIL: {$message}\n");
		exit(1);
	}
}

function assert_same($expected, $actual, string $message): void {
	if ($expected !== $actual) {
		$e = var_export($expected, true);
		$a = var_export($actual, true);
		fwrite(STDERR, "FAIL: {$message}\n  expected: {$e}\n  actual: {$a}\n");
		exit(1);
	}
}

$validator = dirname(__DIR__) . '/includes/class-mrc-request-validator.php';
require_once $validator;

$valid_ticket = MRC_Request_Validator::ticket([
	'firstName' => 'Ada',
	'lastName' => 'Lovelace',
	'phone' => '+1 555 0100',
	'violationType' => 'Speeding',
]);
assert_true(!($valid_ticket instanceof WP_Error), 'valid ticket should succeed');
assert_same('Ada', $valid_ticket['firstName'], 'valid ticket is normalized');

$invalid_ticket = MRC_Request_Validator::ticket([
	'firstName' => '',
	'lastName' => 'Lovelace',
	'phone' => '+1 555 0100',
]);
assert_true($invalid_ticket instanceof WP_Error, 'ticket requires first name');

$invalid_service = MRC_Request_Validator::roadside([
	'serviceType' => 'not-real',
	'customer' => ['firstName' => 'Ada', 'lastName' => 'Lovelace', 'phone' => '1'],
]);
assert_true($invalid_service instanceof WP_Error, 'service type is constrained');

echo "Validator tests passed.\n";
exit(0);
