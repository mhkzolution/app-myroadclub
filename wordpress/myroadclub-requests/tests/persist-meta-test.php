<?php
/**
 * Focused tests for post meta persistence that tolerates unchanged values.
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
			$this->code    = $code;
			$this->message = $message;
			$this->data    = is_array($data) ? $data : array();
		}
	}
}

if (!function_exists('is_wp_error')) {
	function is_wp_error($thing): bool {
		return $thing instanceof WP_Error;
	}
}

if (!defined('MB_IN_BYTES')) {
	define('MB_IN_BYTES', 1048576);
}

$GLOBALS['mrc_update_post_meta_result'] = true;
$GLOBALS['mrc_post_meta']               = array();
$GLOBALS['mrc_update_calls']            = array();

function update_post_meta(int $post_id, string $meta_key, $meta_value) {
	$GLOBALS['mrc_update_calls'][] = array($post_id, $meta_key, $meta_value);
	$result = $GLOBALS['mrc_update_post_meta_result'];
	if (false !== $result && !($result instanceof WP_Error)) {
		$GLOBALS['mrc_post_meta'][$post_id][$meta_key] = $meta_value;
	}
	return $result;
}

function get_post_meta(int $post_id, string $key, bool $single = false) {
	if (!isset($GLOBALS['mrc_post_meta'][$post_id][$key])) {
		return $single ? '' : array();
	}
	$value = $GLOBALS['mrc_post_meta'][$post_id][$key];
	return $single ? $value : array($value);
}

function metadata_exists(string $meta_type, int $object_id, string $meta_key): bool {
	return isset($GLOBALS['mrc_post_meta'][$object_id][$meta_key]);
}

function assert_true(bool $condition, string $message): void {
	if (!$condition) {
		fwrite(STDERR, "FAIL: {$message}\n");
		exit(1);
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

$controller = dirname(__DIR__) . '/includes/class-mrc-request-rest-controller.php';
if (!file_exists($controller)) {
	fwrite(STDERR, "FAIL: request REST controller does not exist\n");
	exit(1);
}
require_once $controller;

assert_true(
	method_exists('MRC_Request_REST_Controller', 'persist_post_meta'),
	'persist_post_meta helper must exist'
);

// Successful update_post_meta returns non-false.
$GLOBALS['mrc_update_post_meta_result'] = 12;
$GLOBALS['mrc_post_meta']               = array();
assert_true(
	MRC_Request_REST_Controller::persist_post_meta(7, '_mrc_customer_first_name', 'Ada'),
	'successful update_post_meta should persist'
);
assert_same('Ada', $GLOBALS['mrc_post_meta'][7]['_mrc_customer_first_name'], 'successful write stores value');

// False + matching existing value is not a failure (unchanged meta).
$GLOBALS['mrc_update_post_meta_result'] = false;
$GLOBALS['mrc_post_meta']               = array(
	7 => array(
		'_mrc_attachment_ids' => array(3, 5),
	),
);
assert_true(
	MRC_Request_REST_Controller::persist_post_meta(7, '_mrc_attachment_ids', array(3, 5)),
	'false with matching existing value should succeed'
);

// False + missing key fails.
$GLOBALS['mrc_update_post_meta_result'] = false;
$GLOBALS['mrc_post_meta']               = array();
assert_true(
	!MRC_Request_REST_Controller::persist_post_meta(7, '_mrc_customer_phone', '555'),
	'false with missing key should fail'
);

// False + different stored value fails.
$GLOBALS['mrc_update_post_meta_result'] = false;
$GLOBALS['mrc_post_meta']               = array(
	7 => array(
		'_mrc_customer_phone' => '111',
	),
);
assert_true(
	!MRC_Request_REST_Controller::persist_post_meta(7, '_mrc_customer_phone', '555'),
	'false with different stored value should fail'
);

// WP_Error result fails.
$GLOBALS['mrc_update_post_meta_result'] = new WP_Error('db_error', 'failed');
$GLOBALS['mrc_post_meta']               = array();
assert_true(
	!MRC_Request_REST_Controller::persist_post_meta(7, '_mrc_customer_phone', '555'),
	'WP_Error from update_post_meta should fail'
);

fwrite(STDOUT, "Persist meta tests passed.\n");
