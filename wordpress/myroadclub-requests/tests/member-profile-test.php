<?php
/**
 * Standalone contracts for the authenticated member profile endpoint.
 */

declare(strict_types=1);

class WP_Error {
	/** @var string */
	public $code;
	/** @var string */
	public $message;
	/** @var array */
	public $data;

	public function __construct(string $code = '', string $message = '', $data = array()) {
		$this->code    = $code;
		$this->message = $message;
		$this->data    = is_array($data) ? $data : array();
	}

	public function get_error_code(): string {
		return $this->code;
	}

	public function get_error_data(): array {
		return $this->data;
	}
}

class WP_User {
	public int $ID;
	public string $user_login;
	public string $first_name;
	public string $last_name;
	public string $display_name;
	public string $user_email;

	public function __construct(int $id, array $fields) {
		$this->ID           = $id;
		$this->user_login   = $fields['user_login'];
		$this->first_name   = $fields['first_name'];
		$this->last_name    = $fields['last_name'];
		$this->display_name = $fields['display_name'];
		$this->user_email   = $fields['user_email'];
	}
}

class WP_REST_Request {
	/** @var array */
	private $params;

	public function __construct(array $params = array()) {
		$this->params = $params;
	}

	public function get_json_params(): array {
		return $this->params;
	}
}

class WP_REST_Response {
	/** @var mixed */
	private $data;
	private int $status;

	public function __construct($data = null, int $status = 200) {
		$this->data   = $data;
		$this->status = $status;
	}

	public function get_data() {
		return $this->data;
	}

	public function get_status(): int {
		return $this->status;
	}
}

class WP_REST_Server {
	public const READABLE = 'GET';
}

$GLOBALS['mrc_current_user_id'] = 7;
$GLOBALS['mrc_users']           = array();
$GLOBALS['mrc_user_meta']       = array();
$GLOBALS['mrc_routes']          = array();
$GLOBALS['mrc_registered_meta'] = array();
$GLOBALS['mrc_update_error']    = null;

function is_wp_error($thing): bool {
	return $thing instanceof WP_Error;
}

function sanitize_text_field($value): string {
	return trim(strip_tags((string) $value));
}

function sanitize_email($value): string {
	return trim((string) $value);
}

function get_current_user_id(): int {
	return $GLOBALS['mrc_current_user_id'];
}

function get_userdata(int $user_id) {
	return $GLOBALS['mrc_users'][$user_id] ?? false;
}

function get_user_meta(int $user_id, string $key, bool $single = false) {
	$value = $GLOBALS['mrc_user_meta'][$user_id][$key] ?? '';
	return $single ? $value : array($value);
}

function metadata_exists(string $type, int $user_id, string $key): bool {
	return 'user' === $type && array_key_exists($key, $GLOBALS['mrc_user_meta'][$user_id] ?? array());
}

function update_user_meta(int $user_id, string $key, $value) {
	$existing = $GLOBALS['mrc_user_meta'][$user_id][$key] ?? null;
	if ($existing === $value) {
		return false;
	}
	$GLOBALS['mrc_user_meta'][$user_id][$key] = $value;
	return true;
}

function wp_update_user(array $fields) {
	if ($GLOBALS['mrc_update_error'] instanceof WP_Error) {
		return $GLOBALS['mrc_update_error'];
	}
	$user = $GLOBALS['mrc_users'][$fields['ID']];
	$user->first_name   = $fields['first_name'];
	$user->last_name    = $fields['last_name'];
	$user->display_name = $fields['display_name'];
	$user->user_email   = $fields['user_email'];
	return $fields['ID'];
}

function register_rest_route(string $namespace, string $route, array $args): void {
	$GLOBALS['mrc_routes'][$namespace . $route] = $args;
}

function register_user_meta(string $key, array $args): void {
	$GLOBALS['mrc_registered_meta'][$key] = $args;
}

function add_action(string $hook, $callback): void {
	// Registration wiring is asserted through public methods below.
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

$controller = dirname(__DIR__) . '/includes/class-mrc-member-profile-controller.php';
if (!file_exists($controller)) {
	fwrite(STDERR, "FAIL: member profile controller does not exist\n");
	exit(1);
}
require_once $controller;

$GLOBALS['mrc_users'][7] = new WP_User(
	7,
	array(
		'user_login'   => 'member-login',
		'first_name'   => 'Ada',
		'last_name'    => 'Lovelace',
		'display_name' => 'Ada Lovelace',
		'user_email'   => 'ada@example.com',
	)
);

$GLOBALS['mrc_user_meta'][7] = array(
	'billing_phone'    => '+15550100',
	'membership_number' => 'MRC-1001',
);

$profile = MRC_Member_Profile_Controller::profile_data($GLOBALS['mrc_users'][7]);
assert_same(7, $profile['id'], 'profile maps the WordPress user ID');
assert_same('member-login', $profile['username'], 'profile maps the immutable username');
assert_same('Ada', $profile['firstName'], 'profile maps first name');
assert_same('Lovelace', $profile['lastName'], 'profile maps last name');
assert_same('Ada Lovelace', $profile['displayName'], 'profile maps display name');
assert_same('ada@example.com', $profile['email'], 'profile maps email');
assert_same('+15550100', $profile['phone'], 'phone falls back to billing_phone');
assert_same('MRC-1001', $profile['membershipId'], 'membership falls back to membership_number');

$GLOBALS['mrc_user_meta'][7]['phone']             = '+10000000';
$GLOBALS['mrc_user_meta'][7]['mrc_phone']         = '+19999999';
$GLOBALS['mrc_user_meta'][7]['membership_id']     = 'OLD-2';
$GLOBALS['mrc_user_meta'][7]['mrc_membership_id'] = 'MRC-PRIMARY';
$profile = MRC_Member_Profile_Controller::profile_data($GLOBALS['mrc_users'][7]);
assert_same('+19999999', $profile['phone'], 'mrc_phone has highest precedence');
assert_same('MRC-PRIMARY', $profile['membershipId'], 'mrc_membership_id has highest precedence');

$valid = MRC_Member_Profile_Controller::validate_update(
	array(
		'firstName'    => ' Grace ',
		'lastName'     => ' Hopper ',
		'displayName'  => ' Grace Hopper ',
		'email'        => 'grace@example.com',
		'phone'        => ' +1 555 0199 ',
		'username'     => 'attempted-change',
		'membershipId' => 'attempted-change',
		'userId'       => 99,
	)
);
assert_true(!is_wp_error($valid), 'a valid profile update succeeds');
assert_same(
	array(
		'firstName'   => 'Grace',
		'lastName'    => 'Hopper',
		'displayName' => 'Grace Hopper',
		'email'       => 'grace@example.com',
		'phone'       => '+1 555 0199',
	),
	$valid,
	'validation returns only normalized editable fields'
);

foreach (
	array(
		array('firstName' => '', 'lastName' => 'Hopper', 'displayName' => 'Grace', 'email' => 'grace@example.com', 'phone' => ''),
		array('firstName' => 'Grace', 'lastName' => '', 'displayName' => 'Grace', 'email' => 'grace@example.com', 'phone' => ''),
		array('firstName' => 'Grace', 'lastName' => 'Hopper', 'displayName' => '', 'email' => 'grace@example.com', 'phone' => ''),
		array('firstName' => 'Grace', 'lastName' => 'Hopper', 'displayName' => 'Grace', 'email' => 'invalid', 'phone' => ''),
		array('firstName' => str_repeat('x', 101), 'lastName' => 'Hopper', 'displayName' => 'Grace', 'email' => 'grace@example.com', 'phone' => ''),
		array('firstName' => 'Grace', 'lastName' => 'Hopper', 'displayName' => 'Grace', 'email' => 'grace@example.com', 'phone' => str_repeat('1', 41)),
	) as $invalid
) {
	$error = MRC_Member_Profile_Controller::validate_update($invalid);
	assert_true($error instanceof WP_Error, 'invalid profile fields return a validation error');
	assert_same(422, $error->get_error_data()['status'], 'validation errors use HTTP 422');
}

MRC_Member_Profile_Controller::register_routes();
$route = $GLOBALS['mrc_routes']['myroadclub/v1/member-profile'];
assert_same('GET', $route[0]['methods'], 'profile route supports GET');
assert_same('PATCH', $route[1]['methods'], 'profile route only supports PATCH updates');
assert_same(
	array('MRC_Member_Profile_Controller', 'require_login'),
	$route[0]['permission_callback'],
	'both methods use the authentication guard'
);

$GLOBALS['mrc_current_user_id'] = 0;
$auth_error = MRC_Member_Profile_Controller::require_login();
assert_true($auth_error instanceof WP_Error, 'anonymous requests are rejected');
assert_same(401, $auth_error->get_error_data()['status'], 'anonymous requests receive HTTP 401');
$GLOBALS['mrc_current_user_id'] = 7;

$response = MRC_Member_Profile_Controller::get_profile(new WP_REST_Request(array('userId' => 99)));
assert_same(7, $response->get_data()['id'], 'GET always resolves the current authenticated user');

$GLOBALS['mrc_user_meta'][7]['billing_phone'] = '+15550100';
$response = MRC_Member_Profile_Controller::update_profile(
	new WP_REST_Request(
		array(
			'userId'      => 99,
			'firstName'   => 'Grace',
			'lastName'    => 'Hopper',
			'displayName' => 'Grace Hopper',
			'email'       => 'grace@example.com',
			'phone'       => '+1 555 0199',
		)
	)
);
assert_true($response instanceof WP_REST_Response, 'PATCH returns a REST response');
assert_same(200, $response->get_status(), 'PATCH succeeds with HTTP 200');
assert_same(7, $response->get_data()['id'], 'PATCH only updates the current authenticated user');
assert_same('+1 555 0199', $GLOBALS['mrc_user_meta'][7]['mrc_phone'], 'PATCH writes canonical mrc_phone');
assert_same('+1 555 0199', $GLOBALS['mrc_user_meta'][7]['billing_phone'], 'PATCH synchronizes existing billing_phone');

$same_response = MRC_Member_Profile_Controller::update_profile(
	new WP_REST_Request(
		array(
			'firstName'   => 'Grace',
			'lastName'    => 'Hopper',
			'displayName' => 'Grace Hopper',
			'email'       => 'grace@example.com',
			'phone'       => '+1 555 0199',
		)
	)
);
assert_true($same_response instanceof WP_REST_Response, 'unchanged meta is verified and treated as success');

$GLOBALS['mrc_update_error'] = new WP_Error('existing_user_email', 'Sensitive database detail');
$safe_error = MRC_Member_Profile_Controller::update_profile(
	new WP_REST_Request(
		array(
			'firstName'   => 'Grace',
			'lastName'    => 'Hopper',
			'displayName' => 'Grace Hopper',
			'email'       => 'used@example.com',
			'phone'       => '',
		)
	)
);
assert_true($safe_error instanceof WP_Error, 'WordPress update errors are mapped');
assert_same(422, $safe_error->get_error_data()['status'], 'WordPress uniqueness errors map to HTTP 422');
assert_true(false === strpos($safe_error->message, 'database'), 'internal update details are not exposed');
$GLOBALS['mrc_update_error'] = null;

MRC_Member_Profile_Controller::register_meta();
assert_same(false, $GLOBALS['mrc_registered_meta']['mrc_phone']['show_in_rest'], 'phone meta remains private');
assert_same(false, $GLOBALS['mrc_registered_meta']['mrc_membership_id']['show_in_rest'], 'membership meta remains private');

echo "Member profile tests passed.\n";
