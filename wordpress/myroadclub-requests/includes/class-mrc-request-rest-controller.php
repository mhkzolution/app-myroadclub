<?php
/**
 * Authenticated REST persistence for ticket and roadside requests.
 *
 * @package MyRoadClub_Requests
 */

/**
 * Handles request creation and ticket media uploads.
 */
class MRC_Request_REST_Controller {

	private const ROUTE_NAMESPACE = 'myroadclub/v1';
	private const MAX_FILES       = 10;
	private const MAX_FILE_SIZE   = 10 * MB_IN_BYTES;
	private const MAX_TOTAL_SIZE  = 50 * MB_IN_BYTES;

	/**
	 * Hook REST route registration.
	 */
	public static function register(): void {
		add_action( 'rest_api_init', array( __CLASS__, 'register_routes' ) );
	}

	/**
	 * Register authenticated request endpoints.
	 */
	public static function register_routes(): void {
		register_rest_route(
			self::ROUTE_NAMESPACE,
			'/ticket-requests',
			array(
				'methods'             => WP_REST_Server::CREATABLE,
				'callback'            => array( self::class, 'create_ticket' ),
				'permission_callback' => array( self::class, 'require_login' ),
			)
		);

		register_rest_route(
			self::ROUTE_NAMESPACE,
			'/roadside-requests',
			array(
				'methods'             => WP_REST_Server::CREATABLE,
				'callback'            => array( self::class, 'create_roadside' ),
				'permission_callback' => array( self::class, 'require_login' ),
			)
		);
	}

	/**
	 * Require an authenticated WordPress user.
	 *
	 * @return true|WP_Error
	 */
	public static function require_login() {
		if ( get_current_user_id() > 0 ) {
			return true;
		}

		return new WP_Error(
			'mrc_authentication_required',
			'Authentication is required.',
			array( 'status' => 401 )
		);
	}

	/**
	 * Create a ticket request and upload its attachments.
	 *
	 * @param WP_REST_Request $request REST request.
	 * @return WP_REST_Response|WP_Error
	 */
	public static function create_ticket( WP_REST_Request $request ) {
		$payload = self::ticket_payload( $request );
		if ( is_wp_error( $payload ) ) {
			return $payload;
		}

		$validated = MRC_Request_Validator::ticket( $payload );
		if ( is_wp_error( $validated ) ) {
			return $validated;
		}

		$files = self::attachment_files();
		if ( is_wp_error( $files ) ) {
			return $files;
		}

		$checked_files = self::validate_files( $files );
		if ( is_wp_error( $checked_files ) ) {
			return $checked_files;
		}

		$stored = self::persist(
			MRC_Request_Post_Types::TICKET_POST_TYPE,
			'TK',
			self::ticket_meta( $validated )
		);
		if ( is_wp_error( $stored ) ) {
			return $stored;
		}

		$post_id                = $stored['id'];
		$created_attachment_ids = array();

		if ( ! empty( $checked_files ) ) {
			require_once ABSPATH . 'wp-admin/includes/file.php';
			require_once ABSPATH . 'wp-admin/includes/image.php';
			require_once ABSPATH . 'wp-admin/includes/media.php';

			foreach ( $checked_files as $file ) {
				$attachment_id = media_handle_sideload( $file, $post_id );
				if ( is_wp_error( $attachment_id ) ) {
					self::rollback( $post_id, $created_attachment_ids );
					return self::storage_error();
				}
				$created_attachment_ids[] = (int) $attachment_id;
			}
		}

		$meta_result = update_post_meta( $post_id, '_mrc_attachment_ids', $created_attachment_ids );
		if ( false === $meta_result || is_wp_error( $meta_result ) ) {
			self::rollback( $post_id, $created_attachment_ids );
			return self::storage_error();
		}

		return rest_ensure_response( $stored );
	}

	/**
	 * Create a roadside request.
	 *
	 * @param WP_REST_Request $request REST request.
	 * @return WP_REST_Response|WP_Error
	 */
	public static function create_roadside( WP_REST_Request $request ) {
		$payload = $request->get_json_params();
		if ( ! is_array( $payload ) ) {
			return self::request_error( 'The request body must be a JSON object.' );
		}

		$validated = MRC_Request_Validator::roadside( $payload );
		if ( is_wp_error( $validated ) ) {
			return $validated;
		}

		$stored = self::persist(
			MRC_Request_Post_Types::ROADSIDE_POST_TYPE,
			'RA',
			self::roadside_meta( $validated )
		);
		if ( is_wp_error( $stored ) ) {
			return $stored;
		}

		return rest_ensure_response( $stored );
	}

	/**
	 * Map a validated ticket payload to registered post meta.
	 *
	 * @param array $ticket Validated ticket payload.
	 * @return array<string, mixed>
	 */
	public static function ticket_meta( array $ticket ): array {
		return array(
			'_mrc_citation_number'     => $ticket['citationNumber'],
			'_mrc_violation_date'      => $ticket['violationDate'],
			'_mrc_violation_state'     => $ticket['state'],
			'_mrc_violation_city'      => $ticket['city'],
			'_mrc_violation_type'      => $ticket['violationType'],
			'_mrc_ticket_description'  => $ticket['description'],
			'_mrc_court_date'          => $ticket['courtDate'],
			'_mrc_customer_first_name' => $ticket['firstName'],
			'_mrc_customer_last_name'  => $ticket['lastName'],
			'_mrc_customer_phone'      => $ticket['phone'],
			'_mrc_customer_email'      => $ticket['email'],
		);
	}

	/**
	 * Map a validated roadside payload to registered post meta.
	 *
	 * @param array $roadside Validated roadside payload.
	 * @return array<string, mixed>
	 */
	public static function roadside_meta( array $roadside ): array {
		$customer = $roadside['customer'];
		$vehicle  = $roadside['vehicle'];
		$location = $roadside['serviceLocation'];
		$extra    = $roadside['additional'];

		$meta = array(
			'_mrc_service_type'          => $roadside['serviceType'],
			'_mrc_service_details'       => $roadside['serviceDetails'],
			'_mrc_customer_first_name'   => $customer['firstName'],
			'_mrc_customer_last_name'    => $customer['lastName'],
			'_mrc_customer_phone'        => $customer['phone'],
			'_mrc_customer_email'        => $customer['email'],
			'_mrc_is_member'             => $customer['isMember'],
			'_mrc_account_name'          => $customer['accountName'],
			'_mrc_membership_id'         => $customer['membershipId'],
			'_mrc_vehicle_year'          => $vehicle['year'],
			'_mrc_vehicle_make'          => $vehicle['make'],
			'_mrc_vehicle_model'         => $vehicle['model'],
			'_mrc_vehicle_color'         => $vehicle['color'],
			'_mrc_vehicle_vin'           => $vehicle['vin'],
			'_mrc_vehicle_plate'         => $vehicle['plate'],
			'_mrc_vehicle_safe_location' => $vehicle['safeLocation'],
			'_mrc_service_address'       => $location['address'],
			'_mrc_service_city'          => $location['city'],
			'_mrc_service_state'         => $location['state'],
			'_mrc_service_zip'           => $location['zip'],
			'_mrc_service_lat'           => $location['lat'],
			'_mrc_service_lng'           => $location['lng'],
			'_mrc_passengers'            => $extra['passengers'],
			'_mrc_drive_type'            => $extra['driveType'],
			'_mrc_with_vehicle'          => $extra['withVehicle'],
		);

		if ( is_array( $roadside['dropOff'] ) ) {
			$drop_off = $roadside['dropOff'];
			$meta     += array(
				'_mrc_dropoff_address' => $drop_off['address'],
				'_mrc_dropoff_city'    => $drop_off['city'],
				'_mrc_dropoff_state'   => $drop_off['state'],
				'_mrc_dropoff_zip'     => $drop_off['zip'],
				'_mrc_dropoff_lat'     => $drop_off['lat'],
				'_mrc_dropoff_lng'     => $drop_off['lng'],
			);
		}

		return $meta;
	}

	/**
	 * Decode a ticket multipart payload.
	 *
	 * @param WP_REST_Request $request REST request.
	 * @return array|WP_Error
	 */
	private static function ticket_payload( WP_REST_Request $request ) {
		$encoded = $request->get_param( 'payload' );
		if ( ! is_string( $encoded ) || '' === trim( $encoded ) ) {
			return self::request_error( 'A JSON payload is required.' );
		}

		$payload = json_decode( $encoded, true );
		if ( JSON_ERROR_NONE !== json_last_error() || ! is_array( $payload ) ) {
			return self::request_error( 'The payload must be a valid JSON object.' );
		}

		return $payload;
	}

	/**
	 * Normalize the PHP multi-file upload shape.
	 *
	 * @return array<int, array>|WP_Error
	 */
	private static function attachment_files() {
		if ( ! isset( $_FILES['attachments'] ) ) {
			return array();
		}

		$uploads = $_FILES['attachments'];
		if ( ! is_array( $uploads ) || ! isset( $uploads['name'], $uploads['tmp_name'], $uploads['error'], $uploads['size'] ) ) {
			return self::request_error( 'Invalid attachment upload.' );
		}

		$names = is_array( $uploads['name'] ) ? $uploads['name'] : array( $uploads['name'] );
		$files = array();

		foreach ( $names as $index => $name ) {
			$file = array(
				'name'     => $name,
				'type'     => self::upload_value( $uploads, 'type', $index ),
				'tmp_name' => self::upload_value( $uploads, 'tmp_name', $index ),
				'error'    => self::upload_value( $uploads, 'error', $index ),
				'size'     => self::upload_value( $uploads, 'size', $index ),
			);

			if ( UPLOAD_ERR_NO_FILE === (int) $file['error'] ) {
				continue;
			}
			$files[] = $file;
		}

		return $files;
	}

	/**
	 * Read a scalar or indexed field from a PHP upload array.
	 *
	 * @param array      $uploads Upload data.
	 * @param string     $key     Field key.
	 * @param int|string $index   Upload index.
	 * @return mixed
	 */
	private static function upload_value( array $uploads, string $key, $index ) {
		if ( ! array_key_exists( $key, $uploads ) ) {
			return null;
		}
		return is_array( $uploads[ $key ] ) ? ( $uploads[ $key ][ $index ] ?? null ) : $uploads[ $key ];
	}

	/**
	 * Validate attachment limits and actual MIME types.
	 *
	 * @param array<int, array> $files Normalized uploads.
	 * @return array<int, array>|WP_Error
	 */
	private static function validate_files( array $files ) {
		if ( count( $files ) > self::MAX_FILES ) {
			return self::size_error( 'A maximum of 10 attachments is allowed.' );
		}

		$total_size = 0;
		foreach ( $files as $file ) {
			if ( UPLOAD_ERR_OK !== (int) $file['error'] ) {
				return self::request_error( 'An attachment could not be uploaded.' );
			}

			$size = (int) $file['size'];
			if ( $size > self::MAX_FILE_SIZE ) {
				return self::size_error( 'Each attachment must be 10 MB or smaller.' );
			}
			$total_size += $size;
			if ( $total_size > self::MAX_TOTAL_SIZE ) {
				return self::size_error( 'Attachments must total 50 MB or less.' );
			}

			$checked = wp_check_filetype_and_ext( $file['tmp_name'], $file['name'] );
			$type    = isset( $checked['type'] ) ? $checked['type'] : false;
			if ( ! in_array( $type, array( 'image/jpeg', 'image/png', 'application/pdf' ), true ) ) {
				return self::request_error( 'Only JPEG, PNG, and PDF attachments are allowed.' );
			}
		}

		return $files;
	}

	/**
	 * Persist a pending request and assign its reference title.
	 *
	 * @param string               $post_type Request post type.
	 * @param string               $prefix    Reference prefix.
	 * @param array<string, mixed> $meta      Request meta.
	 * @return array|WP_Error
	 */
	private static function persist( string $post_type, string $prefix, array $meta ) {
		$post_id = wp_insert_post(
			array(
				'post_type'   => $post_type,
				'post_status' => 'pending',
				'post_author' => get_current_user_id(),
				'post_title'  => 'Pending request',
			),
			true
		);

		if ( is_wp_error( $post_id ) || ! $post_id ) {
			return self::storage_error();
		}

		foreach ( $meta as $key => $value ) {
			$result = update_post_meta( $post_id, $key, $value );
			if ( false === $result || is_wp_error( $result ) ) {
				wp_delete_post( $post_id, true );
				return self::storage_error();
			}
		}

		$reference = sprintf( '%s-%s-%d', $prefix, current_time( 'Ymd' ), $post_id );
		$updated   = wp_update_post(
			array(
				'ID'         => $post_id,
				'post_title' => $reference,
			),
			true
		);

		if ( is_wp_error( $updated ) || ! $updated ) {
			wp_delete_post( $post_id, true );
			return self::storage_error();
		}

		$created_at = get_post_time( DATE_ATOM, true, $post_id );
		if ( ! is_string( $created_at ) || '' === $created_at ) {
			wp_delete_post( $post_id, true );
			return self::storage_error();
		}

		return array(
			'id'        => (int) $post_id,
			'reference' => $reference,
			'status'    => 'pending',
			'createdAt' => $created_at,
		);
	}

	/**
	 * Delete uploaded media and its parent request.
	 *
	 * @param int             $post_id        Request post ID.
	 * @param array<int, int> $attachment_ids Uploaded attachment IDs.
	 */
	private static function rollback( int $post_id, array $attachment_ids ): void {
		foreach ( $attachment_ids as $attachment_id ) {
			wp_delete_attachment( $attachment_id, true );
		}
		wp_delete_post( $post_id, true );
	}

	/**
	 * @param string $message Safe client-facing message.
	 */
	private static function request_error( string $message ): WP_Error {
		return new WP_Error( 'mrc_request_error', $message, array( 'status' => 422 ) );
	}

	/**
	 * @param string $message Safe client-facing message.
	 */
	private static function size_error( string $message ): WP_Error {
		return new WP_Error( 'mrc_upload_too_large', $message, array( 'status' => 413 ) );
	}

	/**
	 * Return a generic storage error without exposing internals.
	 */
	private static function storage_error(): WP_Error {
		return new WP_Error(
			'mrc_storage_error',
			'The request could not be saved. Please try again.',
			array( 'status' => 500 )
		);
	}
}
