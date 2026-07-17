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
$GLOBALS['mrc_meta_fail_keys']  = array();
$GLOBALS['mrc_update_partial']  = false;
$GLOBALS['mrc_write_log']       = array();

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
	$GLOBALS['mrc_write_log'][] = array('op' => 'update_user_meta', 'user_id' => $user_id, 'key' => $key, 'value' => $value);
	if (in_array($key, $GLOBALS['mrc_meta_fail_keys'], true)) {
		$GLOBALS['mrc_meta_fail_keys'] = array_values(
			array_diff($GLOBALS['mrc_meta_fail_keys'], array($key))
		);
		return new WP_Error('db_update_error', 'Sensitive meta failure detail');
	}
	$existing = $GLOBALS['mrc_user_meta'][$user_id][$key] ?? null;
	if ($existing === $value) {
		return false;
	}
	$GLOBALS['mrc_user_meta'][$user_id][$key] = $value;
	return true;
}

function delete_user_meta(int $user_id, string $key) {
	$GLOBALS['mrc_write_log'][] = array('op' => 'delete_user_meta', 'user_id' => $user_id, 'key' => $key);
	unset($GLOBALS['mrc_user_meta'][$user_id][$key]);
	return true;
}

function email_exists($email) {
	foreach ($GLOBALS['mrc_users'] as $id => $user) {
		if ($user->user_email === (string) $email) {
			return (int) $id;
		}
	}
	return false;
}

function wp_update_user(array $fields) {
	$GLOBALS['mrc_write_log'][] = array('op' => 'wp_update_user', 'fields' => $fields);
	if ($GLOBALS['mrc_update_partial']) {
		$GLOBALS['mrc_update_partial'] = false;
		$user = $GLOBALS['mrc_users'][$fields['ID']];
		$user->first_name = $fields['first_name'];
		return new WP_Error('db_update_error', 'Sensitive database detail');
	}
	if ($GLOBALS['mrc_update_error'] instanceof WP_Error) {
		$error = $GLOBALS['mrc_update_error'];
		$GLOBALS['mrc_update_error'] = null;
		return $error;
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

$GLOBALS['mrc_user_meta'][7]['phone']         = '+10000000';
$GLOBALS['mrc_user_meta'][7]['membership_id'] = 'MRC-SECONDARY';
$profile = MRC_Member_Profile_Controller::profile_data($GLOBALS['mrc_users'][7]);
assert_same('+15550100', $profile['phone'], 'billing_phone takes precedence over phone');
assert_same('MRC-SECONDARY', $profile['membershipId'], 'membership_id takes precedence over membership_number');

$GLOBALS['mrc_user_meta'][7]['mrc_phone']         = '+19999999';
$GLOBALS['mrc_user_meta'][7]['mrc_membership_id'] = 'MRC-PRIMARY';
$profile = MRC_Member_Profile_Controller::profile_data($GLOBALS['mrc_users'][7]);
assert_same('+19999999', $profile['phone'], 'mrc_phone has highest precedence');
assert_same('MRC-PRIMARY', $profile['membershipId'], 'mrc_membership_id has highest precedence');

$GLOBALS['mrc_user_meta'][7]['mrc_phone'] = '';
$profile = MRC_Member_Profile_Controller::profile_data($GLOBALS['mrc_users'][7]);
assert_same('', $profile['phone'], 'an empty canonical phone does not resurrect legacy phone metadata');

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

$utf8_valid = MRC_Member_Profile_Controller::validate_update(
	array(
		'firstName'   => str_repeat('é', 100),
		'lastName'    => 'Hopper',
		'displayName' => 'Grace Hopper',
		'email'       => 'grace@example.com',
		'phone'       => '',
	)
);
assert_true(!is_wp_error($utf8_valid), 'text limits count UTF-8 characters rather than bytes');

$utf8_invalid = MRC_Member_Profile_Controller::validate_update(
	array(
		'firstName'   => str_repeat('é', 101),
		'lastName'    => 'Hopper',
		'displayName' => 'Grace Hopper',
		'email'       => 'grace@example.com',
		'phone'       => '',
	)
);
assert_true($utf8_invalid instanceof WP_Error, 'UTF-8 text over the character limit is rejected');

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
	'GET uses the authentication guard'
);
assert_same(
	array('MRC_Member_Profile_Controller', 'require_login'),
	$route[1]['permission_callback'],
	'PATCH uses the authentication guard'
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

$GLOBALS['mrc_user_meta'][7]['phone'] = '+1 555 0100';
unset($GLOBALS['mrc_user_meta'][7]['billing_phone']);
$without_billing = MRC_Member_Profile_Controller::update_profile(
	new WP_REST_Request(
		array(
			'firstName'   => 'Grace',
			'lastName'    => 'Hopper',
			'displayName' => 'Grace Hopper',
			'email'       => 'grace@example.com',
			'phone'       => '+1 555 0188',
		)
	)
);
assert_true($without_billing instanceof WP_REST_Response, 'PATCH succeeds without billing_phone');
assert_true(
	!array_key_exists('billing_phone', $GLOBALS['mrc_user_meta'][7]),
	'PATCH does not create billing_phone when it is absent'
);

$same_response = MRC_Member_Profile_Controller::update_profile(
	new WP_REST_Request(
		array(
			'firstName'   => 'Grace',
			'lastName'    => 'Hopper',
			'displayName' => 'Grace Hopper',
			'email'       => 'grace@example.com',
			'phone'       => '+1 555 0188',
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

// --- Atomic update contracts ---

function reset_member_profile_state(): void {
	$GLOBALS['mrc_current_user_id'] = 7;
	$GLOBALS['mrc_update_error']    = null;
	$GLOBALS['mrc_meta_fail_keys']  = array();
	$GLOBALS['mrc_update_partial']  = false;
	$GLOBALS['mrc_write_log']       = array();
	$GLOBALS['mrc_users']           = array(
		7 => new WP_User(
			7,
			array(
				'user_login'   => 'member-login',
				'first_name'   => 'Ada',
				'last_name'    => 'Lovelace',
				'display_name' => 'Ada Lovelace',
				'user_email'   => 'ada@example.com',
			)
		),
	);
	$GLOBALS['mrc_user_meta'] = array(
		7 => array(
			'billing_phone' => '+15550100',
		),
	);
}

function profile_update_payload(array $overrides = array()): WP_REST_Request {
	return new WP_REST_Request(
		array_merge(
			array(
				'firstName'   => 'Grace',
				'lastName'    => 'Hopper',
				'displayName' => 'Grace Hopper',
				'email'       => 'grace@example.com',
				'phone'       => '+1 555 0199',
			),
			$overrides
		)
	);
}

function count_writes_for(string $op): int {
	$count = 0;
	foreach ($GLOBALS['mrc_write_log'] as $entry) {
		if ($entry['op'] === $op) {
			$count++;
		}
	}
	return $count;
}

reset_member_profile_state();
$GLOBALS['mrc_users'][9] = new WP_User(
	9,
	array(
		'user_login'   => 'other-member',
		'first_name'   => 'Other',
		'last_name'    => 'Member',
		'display_name' => 'Other Member',
		'user_email'   => 'taken@example.com',
	)
);
$before_meta = $GLOBALS['mrc_user_meta'][7];
$before_user = clone $GLOBALS['mrc_users'][7];
$duplicate = MRC_Member_Profile_Controller::update_profile(
	profile_update_payload(array('email' => 'taken@example.com'))
);
assert_true($duplicate instanceof WP_Error, 'duplicate email is rejected before writes');
assert_same('mrc_profile_validation_error', $duplicate->get_error_code(), 'duplicate email uses validation code');
assert_same(422, $duplicate->get_error_data()['status'], 'duplicate email returns HTTP 422');
assert_same(0, count_writes_for('update_user_meta'), 'duplicate email performs zero meta writes');
assert_same(0, count_writes_for('wp_update_user'), 'duplicate email performs zero core writes');
assert_same($before_meta, $GLOBALS['mrc_user_meta'][7], 'duplicate email leaves meta unchanged');
assert_same($before_user->first_name, $GLOBALS['mrc_users'][7]->first_name, 'duplicate email leaves core first_name unchanged');
assert_same($before_user->user_email, $GLOBALS['mrc_users'][7]->user_email, 'duplicate email leaves core email unchanged');

reset_member_profile_state();
$own_email = MRC_Member_Profile_Controller::update_profile(
	profile_update_payload(array('email' => 'ada@example.com', 'phone' => '+1 555 0111'))
);
assert_true($own_email instanceof WP_REST_Response, 'current user may keep their own email');
assert_same(200, $own_email->get_status(), 'own-email update succeeds');
assert_same('+1 555 0111', $GLOBALS['mrc_user_meta'][7]['mrc_phone'], 'own-email update still writes phone');

reset_member_profile_state();
$GLOBALS['mrc_meta_fail_keys'] = array('billing_phone');
$meta_fail = MRC_Member_Profile_Controller::update_profile(profile_update_payload());
assert_true($meta_fail instanceof WP_Error, 'billing phone write failures are returned');
assert_same(500, $meta_fail->get_error_data()['status'], 'meta write failures map to HTTP 500');
assert_true(false === strpos($meta_fail->message, 'Sensitive'), 'meta failure details are not exposed');
assert_true(
	!array_key_exists('mrc_phone', $GLOBALS['mrc_user_meta'][7]),
	'failed billing sync rolls back newly written mrc_phone'
);
assert_same('+15550100', $GLOBALS['mrc_user_meta'][7]['billing_phone'], 'failed billing sync restores original billing_phone');
assert_same('Ada', $GLOBALS['mrc_users'][7]->first_name, 'meta failure leaves core first_name unchanged');
assert_same('ada@example.com', $GLOBALS['mrc_users'][7]->user_email, 'meta failure leaves core email unchanged');

reset_member_profile_state();
$GLOBALS['mrc_meta_fail_keys'] = array('mrc_phone');
$mrc_fail = MRC_Member_Profile_Controller::update_profile(profile_update_payload());
assert_true($mrc_fail instanceof WP_Error, 'mrc_phone write failures are returned');
assert_same(500, $mrc_fail->get_error_data()['status'], 'mrc_phone failures map to HTTP 500');
assert_true(
	!array_key_exists('mrc_phone', $GLOBALS['mrc_user_meta'][7]),
	'mrc_phone failure does not leave a partial phone key'
);
assert_same('+15550100', $GLOBALS['mrc_user_meta'][7]['billing_phone'], 'mrc_phone failure leaves billing_phone untouched');
assert_same(0, count_writes_for('wp_update_user'), 'phone meta failure prevents core updates');

reset_member_profile_state();
$GLOBALS['mrc_update_error'] = new WP_Error('update_failed', 'Sensitive database detail');
$core_fail = MRC_Member_Profile_Controller::update_profile(profile_update_payload());
assert_true($core_fail instanceof WP_Error, 'core update failures are returned');
assert_true(false === strpos($core_fail->message, 'Sensitive'), 'core update internals are not exposed');
assert_true(
	!array_key_exists('mrc_phone', $GLOBALS['mrc_user_meta'][7]),
	'core update failure restores phone metadata existence'
);
assert_same('+15550100', $GLOBALS['mrc_user_meta'][7]['billing_phone'], 'core update failure restores billing_phone');
assert_same('Ada', $GLOBALS['mrc_users'][7]->first_name, 'core update failure leaves original first_name');
assert_same('ada@example.com', $GLOBALS['mrc_users'][7]->user_email, 'core update failure leaves original email');

reset_member_profile_state();
$GLOBALS['mrc_update_partial'] = true;
$partial = MRC_Member_Profile_Controller::update_profile(profile_update_payload());
assert_true($partial instanceof WP_Error, 'partial core mutation failures are returned');
assert_same('mrc_profile_update_error', $partial->get_error_code(), 'restored partial core failures map to update error');
assert_same(422, $partial->get_error_data()['status'], 'confirmed restore after partial core mutation returns HTTP 422');
assert_true(false === strpos($partial->message, 'Sensitive'), 'partial core internals are not exposed');
assert_true(
	!array_key_exists('mrc_phone', $GLOBALS['mrc_user_meta'][7]),
	'partial core failure restores phone metadata'
);
assert_same('Ada', $GLOBALS['mrc_users'][7]->first_name, 'partial core failure restores first_name');
assert_same('Lovelace', $GLOBALS['mrc_users'][7]->last_name, 'partial core failure restores last_name');
assert_same('Ada Lovelace', $GLOBALS['mrc_users'][7]->display_name, 'partial core failure restores display_name');
assert_same('ada@example.com', $GLOBALS['mrc_users'][7]->user_email, 'partial core failure restores email');

reset_member_profile_state();
$success = MRC_Member_Profile_Controller::update_profile(profile_update_payload());
assert_true($success instanceof WP_REST_Response, 'successful atomic update returns a REST response');
assert_same(200, $success->get_status(), 'successful atomic update returns HTTP 200');
assert_same('Grace', $GLOBALS['mrc_users'][7]->first_name, 'successful update commits first_name');
assert_same('grace@example.com', $GLOBALS['mrc_users'][7]->user_email, 'successful update commits email');
assert_same('+1 555 0199', $GLOBALS['mrc_user_meta'][7]['mrc_phone'], 'successful update commits mrc_phone');
assert_same('+1 555 0199', $GLOBALS['mrc_user_meta'][7]['billing_phone'], 'successful update syncs billing_phone');

echo "Member profile tests passed.\n";
