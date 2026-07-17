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

if (!class_exists('WP_REST_Response')) {
	class WP_REST_Response {
		/** @var mixed */
		public $data;
		/** @var int */
		public $status;

		public function __construct($data = null, int $status = 200) {
			$this->data = $data;
			$this->status = $status;
		}

		public function get_status(): int {
			return $this->status;
		}

		public function get_data() {
			return $this->data;
		}
	}
}

if (!defined('MB_IN_BYTES')) {
	define('MB_IN_BYTES', 1048576);
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
require_once $includes . '/class-mrc-request-rest-controller.php';

$valid_ticket = MRC_Request_Validator::ticket([
	'firstName' => 'Ada',
	'lastName' => 'Lovelace',
	'phone' => '+1 555 0100',
	'violationType' => 'Speeding',
]);
assert_true(!($valid_ticket instanceof WP_Error), 'valid ticket should succeed');
assert_same('Ada', $valid_ticket['firstName'], 'valid ticket is normalized');

$ticket_meta = MRC_Request_REST_Controller::ticket_meta($valid_ticket);
assert_same('Ada', $ticket_meta['_mrc_customer_first_name'], 'ticket meta maps first name');

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

$roadside_meta = MRC_Request_REST_Controller::roadside_meta($non_towing);
assert_same('jump-start', $roadside_meta['_mrc_service_type'], 'roadside meta maps service');
assert_true(!array_key_exists('_mrc_dropoff_address', $roadside_meta), 'non-towing omits drop-off');
assert_true(!array_key_exists('_mrc_account_name', $roadside_meta), 'non-member omits account name');
assert_true(!array_key_exists('_mrc_membership_id', $roadside_meta), 'non-member omits membership id');

$member = MRC_Request_Validator::roadside([
	'serviceType' => 'jump-start',
	'customer' => [
		'firstName' => 'Ada',
		'lastName' => 'Lovelace',
		'phone' => '+1 555 0100',
		'isMember' => true,
		'accountName' => 'Ada Lovelace',
		'membershipId' => 'MRC-42',
	],
]);
assert_true(!($member instanceof WP_Error), 'member roadside should succeed');
$member_meta = MRC_Request_REST_Controller::roadside_meta($member);
assert_same('Ada Lovelace', $member_meta['_mrc_account_name'], 'member retains account name');
assert_same('MRC-42', $member_meta['_mrc_membership_id'], 'member retains membership id');

$created = MRC_Request_REST_Controller::created_response([
	'id' => 12,
	'reference' => 'TK-20260717-12',
	'status' => 'pending',
	'createdAt' => '2026-07-17T00:00:00+00:00',
]);
assert_true($created instanceof WP_REST_Response, 'created_response returns WP_REST_Response');
assert_same(201, $created->get_status(), 'created_response uses HTTP 201');
assert_same(12, $created->get_data()['id'], 'created_response keeps payload');

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
