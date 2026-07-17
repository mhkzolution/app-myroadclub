<?php
/**
 * Plugin Name: MyRoadClub Requests
 * Description: Stores authenticated ticket and roadside requests.
 * Version: 1.0.0
 * Author: MyRoadClub
 * Text Domain: myroadclub-requests
 */

defined( 'ABSPATH' ) || exit;

define( 'MRC_REQUESTS_VERSION', '1.0.0' );
define( 'MRC_REQUESTS_FILE', __FILE__ );
define( 'MRC_REQUESTS_DIR', plugin_dir_path( __FILE__ ) );

require_once MRC_REQUESTS_DIR . 'includes/class-mrc-request-post-types.php';
require_once MRC_REQUESTS_DIR . 'includes/class-mrc-request-validator.php';

MRC_Request_Post_Types::register();
