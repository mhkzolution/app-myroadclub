<?php
/**
 * Lightweight contract tests for request admin views.
 */

declare(strict_types=1);

final class WP_Post {
	public int $ID;
	public string $post_status;

	public function __construct(int $id, string $status = 'pending') {
		$this->ID          = $id;
		$this->post_status = $status;
	}
}

$GLOBALS['mrc_test_meta']             = array();
$GLOBALS['mrc_attachment_link_calls'] = array();
$GLOBALS['mrc_kses_calls']            = 0;
$GLOBALS['mrc_can_edit_post']         = true;
$GLOBALS['mrc_edit_post_link']        = 'https://example.test/wp-admin/post.php?post=42&action=edit';

function get_post_meta(int $post_id, string $key, bool $single = false) {
	return $GLOBALS['mrc_test_meta'][$key] ?? ($single ? '' : array());
}

function get_the_title(int $post_id): string {
	return 'TK-20260717-' . $post_id;
}

function get_post_status_object(string $status): object {
	return (object) array('label' => ucfirst($status));
}

function get_the_date(string $format, int $post_id): string {
	return 'July 17, 2026';
}

function get_option(string $name): string {
	return 'F j, Y';
}

function current_user_can(string $capability, ...$args): bool {
	return (bool) $GLOBALS['mrc_can_edit_post'];
}

function get_edit_post_link(int $post_id, string $context = 'display') {
	return $GLOBALS['mrc_edit_post_link'];
}

function esc_html($value): string {
	return htmlspecialchars((string) $value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

function esc_url(string $url): string {
	return htmlspecialchars($url, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

function add_query_arg(array $args, string $url): string {
	return $url . '?' . http_build_query($args);
}

function wp_get_attachment_link(int $id): string {
	$GLOBALS['mrc_attachment_link_calls'][] = $id;
	return '<a href="attachment-' . $id . '">Attachment ' . $id . '</a>';
}

function wp_kses_post(string $html): string {
	++$GLOBALS['mrc_kses_calls'];
	return $html;
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

function assert_contains(string $needle, string $haystack, string $message): void {
	if (false === strpos($haystack, $needle)) {
		fwrite(STDERR, "FAIL: {$message}\n  missing: {$needle}\n");
		exit(1);
	}
}

require_once dirname(__DIR__) . '/includes/class-mrc-request-post-types.php';
$admin_file = dirname(__DIR__) . '/includes/class-mrc-request-admin.php';
if (!file_exists($admin_file)) {
	fwrite(STDERR, "FAIL: request admin class does not exist\n");
	exit(1);
}
require_once $admin_file;

$columns = MRC_Request_Admin::columns(array('title' => 'Title', 'author' => 'Author'));
assert_same(
	array(
		'cb'        => '<input type="checkbox" />',
		'reference' => 'Reference',
		'requester' => 'Requester',
		'phone'     => 'Phone',
		'type'      => 'Type',
		'status'    => 'Status',
		'date'      => 'Date',
	),
	$columns,
	'request list uses the required columns'
);

assert_same(
	'reference',
	MRC_Request_Admin::primary_column('title', 'edit-' . MRC_Request_Post_Types::TICKET_POST_TYPE),
	'ticket list uses reference as the primary column'
);
assert_same(
	'reference',
	MRC_Request_Admin::primary_column('title', 'edit-' . MRC_Request_Post_Types::ROADSIDE_POST_TYPE),
	'roadside list uses reference as the primary column'
);
assert_same(
	'title',
	MRC_Request_Admin::primary_column('title', 'edit-post'),
	'unrelated screens keep their primary column'
);

$GLOBALS['mrc_test_meta'] = array(
	'_mrc_customer_first_name' => '<Ada>',
	'_mrc_customer_last_name'  => 'Lovelace',
	'_mrc_customer_phone'      => '<script>phone</script>',
	'_mrc_violation_type'      => 'Speeding',
);

$GLOBALS['mrc_can_edit_post']  = true;
$GLOBALS['mrc_edit_post_link'] = 'https://example.test/wp-admin/post.php?post=42&action=edit&evil="<script>"';
ob_start();
MRC_Request_Admin::render_ticket_column('reference', 42);
$reference_link = (string) ob_get_clean();
assert_contains(
	'<a class="row-title" href="https://example.test/wp-admin/post.php?post=42&amp;action=edit&amp;evil=&quot;&lt;script&gt;&quot;">TK-20260717-42</a>',
	$reference_link,
	'reference renders an escaped edit link when the user can edit'
);

$GLOBALS['mrc_can_edit_post'] = false;
ob_start();
MRC_Request_Admin::render_ticket_column('reference', 42);
$reference_plain = (string) ob_get_clean();
assert_same('TK-20260717-42', $reference_plain, 'reference falls back to escaped plain text without edit capability');

$GLOBALS['mrc_can_edit_post']  = true;
$GLOBALS['mrc_edit_post_link'] = null;
ob_start();
MRC_Request_Admin::render_ticket_column('reference', 42);
$reference_missing_link = (string) ob_get_clean();
assert_same('TK-20260717-42', $reference_missing_link, 'reference falls back when no edit link is available');

ob_start();
MRC_Request_Admin::render_ticket_column('requester', 42);
$requester = (string) ob_get_clean();
assert_same('&lt;Ada&gt; Lovelace', $requester, 'requester list value is escaped');

ob_start();
MRC_Request_Admin::render_ticket_column('phone', 42);
$phone = (string) ob_get_clean();
assert_same('&lt;script&gt;phone&lt;/script&gt;', $phone, 'phone list value is escaped');

$GLOBALS['mrc_test_meta'] = array(
	'_mrc_ticket_description' => "Line one\n<script>alert(1)</script>",
	'_mrc_service_lat'        => '30.2672',
	'_mrc_service_lng'        => '-97.7431',
	'_mrc_attachment_ids'     => array(7, 9),
);

ob_start();
MRC_Request_Admin::render_ticket_details(new WP_Post(42));
$ticket_details = (string) ob_get_clean();
assert_contains("Line one<br />\n&lt;script&gt;alert(1)&lt;/script&gt;", $ticket_details, 'multiline detail is escaped before line breaks');
assert_contains('Attachment 7', $ticket_details, 'saved attachment is linked');
assert_contains('Attachment 9', $ticket_details, 'all saved attachments are linked');
assert_same(array(7, 9), $GLOBALS['mrc_attachment_link_calls'], 'attachment links use saved IDs');
assert_same(2, $GLOBALS['mrc_kses_calls'], 'attachment link HTML is passed through WordPress allowlist escaping');

$GLOBALS['mrc_test_meta'] = array(
	'_mrc_service_lat'  => '30.2672',
	'_mrc_service_lng'  => '-97.7431',
	'_mrc_service_type' => 'towing',
);

ob_start();
MRC_Request_Admin::render_roadside_details(new WP_Post(51));
$roadside_details = (string) ob_get_clean();
assert_contains(
	'https://www.google.com/maps/search/?api=1&amp;query=30.2672%2C-97.7431',
	$roadside_details,
	'map URL is built with add_query_arg and escaped'
);

echo "Admin tests passed.\n";
