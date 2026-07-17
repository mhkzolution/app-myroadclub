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

$includes = dirname(__DIR__) . '/includes';
require_once $includes . '/class-mrc-request-validator.php';
require_once $includes . '/class-mrc-request-post-types.php';

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

$non_towing = MRC_Request_Validator::roadside([
	'serviceType' => 'jump-start',
	'customer' => [
		'firstName' => 'Ada',
		'lastName' => 'Lovelace',
		'phone' => '+1 555 0100',
		'isMember' => false,
		'accountName' => 'Should Clear',
		'membershipId' => 'MRC-1',
	],
	'dropOff' => [
		'address' => '99 Drop St',
		'city' => 'Austin',
		'state' => 'TX',
		'zip' => '78701',
		'lat' => 30.1,
		'lng' => -97.7,
	],
]);
assert_true(!($non_towing instanceof WP_Error), 'non-towing roadside should succeed');
assert_same(null, $non_towing['dropOff'], 'non-towing clears drop-off');
assert_same('', $non_towing['customer']['accountName'], 'isMember false clears accountName');
assert_same('', $non_towing['customer']['membershipId'], 'isMember false clears membershipId');

$towing = MRC_Request_Validator::roadside([
	'serviceType' => 'towing',
	'customer' => [
		'firstName' => 'Ada',
		'lastName' => 'Lovelace',
		'phone' => '+1 555 0100',
	],
	'dropOff' => [
		'address' => '99 Drop St',
		'city' => 'Austin',
		'state' => 'TX',
		'zip' => '78701',
		'lat' => 30.1,
		'lng' => -97.7,
	],
]);
assert_true(!($towing instanceof WP_Error), 'towing roadside should succeed');
assert_true(is_array($towing['dropOff']), 'towing retains drop-off');
assert_same('99 Drop St', $towing['dropOff']['address'], 'towing keeps drop-off address');

$invalid_date = MRC_Request_Validator::ticket([
	'firstName' => 'Ada',
	'lastName' => 'Lovelace',
	'phone' => '+1 555 0100',
	'violationDate' => '2026-13-40',
]);
assert_true($invalid_date instanceof WP_Error, 'invalid date is rejected');

$invalid_email = MRC_Request_Validator::ticket([
	'firstName' => 'Ada',
	'lastName' => 'Lovelace',
	'phone' => '+1 555 0100',
	'email' => 'not-an-email',
]);
assert_true($invalid_email instanceof WP_Error, 'invalid email is rejected');

$invalid_coordinate = MRC_Request_Validator::roadside([
	'serviceType' => 'jump-start',
	'customer' => ['firstName' => 'Ada', 'lastName' => 'Lovelace', 'phone' => '1'],
	'serviceLocation' => ['lat' => 120],
]);
assert_true($invalid_coordinate instanceof WP_Error, 'invalid coordinate is rejected');

$over_limit = MRC_Request_Validator::ticket([
	'firstName' => str_repeat('A', 101),
	'lastName' => 'Lovelace',
	'phone' => '+1 555 0100',
]);
assert_true($over_limit instanceof WP_Error, 'over-limit string is rejected');

assert_same(false, MRC_Request_Post_Types::sanitize_boolean('false'), 'string false sanitizes to false');
assert_same(false, MRC_Request_Post_Types::sanitize_boolean('0'), 'string 0 sanitizes to false');
assert_same(true, MRC_Request_Post_Types::sanitize_boolean('true'), 'string true sanitizes to true');
assert_same(true, MRC_Request_Post_Types::sanitize_boolean(1), 'integer 1 sanitizes to true');

echo "Validator tests passed.\n";
exit(0);
