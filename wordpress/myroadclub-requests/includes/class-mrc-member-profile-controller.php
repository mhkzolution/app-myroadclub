<?php
/**
 * Authenticated member profile REST API.
 *
 * @package MyRoadClub_Requests
 */

/**
 * Reads and updates the current WordPress user's member profile.
 */
class MRC_Member_Profile_Controller {

	private const ROUTE_NAMESPACE = 'myroadclub/v1';
	private const LEN_NAME        = 100;
	private const LEN_DISPLAY     = 100;
	private const LEN_EMAIL       = 254;
	private const LEN_PHONE       = 40;

	/**
	 * Hook route and private user-meta registration.
	 */
	public static function register(): void {
		add_action( 'rest_api_init', array( __CLASS__, 'register_routes' ) );
		add_action( 'init', array( __CLASS__, 'register_meta' ) );
	}

	/**
	 * Register the current-member profile routes.
	 */
	public static function register_routes(): void {
		register_rest_route(
			self::ROUTE_NAMESPACE,
			'/member-profile',
			array(
				array(
					'methods'             => WP_REST_Server::READABLE,
					'callback'            => array( __CLASS__, 'get_profile' ),
					'permission_callback' => array( __CLASS__, 'require_login' ),
				),
				array(
					'methods'             => 'PATCH',
					'callback'            => array( __CLASS__, 'update_profile' ),
					'permission_callback' => array( __CLASS__, 'require_login' ),
				),
			)
		);
	}

	/**
	 * Register canonical plugin-owned profile metadata without exposing it in REST.
	 */
	public static function register_meta(): void {
		$args = array(
			'type'              => 'string',
			'single'            => true,
			'show_in_rest'      => false,
			'sanitize_callback' => 'sanitize_text_field',
			'auth_callback'     => static function ( $allowed, $meta_key, $user_id ): bool {
				return current_user_can( 'edit_user', $user_id );
			},
		);

		register_user_meta( 'mrc_phone', $args );
		register_user_meta( 'mrc_membership_id', $args );
	}

	/**
	 * Require a user established by WordPress authentication, including JWT auth.
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
	 * Return the current authenticated user's profile.
	 *
	 * @param WP_REST_Request $request REST request.
	 * @return WP_REST_Response|WP_Error
	 */
	public static function get_profile( WP_REST_Request $request ) {
		$user = get_userdata( get_current_user_id() );
		if ( ! $user instanceof WP_User ) {
			return self::storage_error();
		}

		return new WP_REST_Response( self::profile_data( $user ), 200 );
	}

	/**
	 * Update editable fields for the current authenticated user.
	 *
	 * Phone metadata is written and verified before core user fields so a later
	 * failure can restore meta snapshots. Email uniqueness is checked before any
	 * writes.
	 *
	 * @param WP_REST_Request $request REST request.
	 * @return WP_REST_Response|WP_Error
	 */
	public static function update_profile( WP_REST_Request $request ) {
		$user_id = get_current_user_id();
		$user    = get_userdata( $user_id );
		if ( ! $user instanceof WP_User ) {
			return self::storage_error();
		}

		$payload = $request->get_json_params();
		if ( ! is_array( $payload ) ) {
			return self::validation_error( 'The request body must be a JSON object.' );
		}

		$validated = self::validate_update( $payload );
		if ( is_wp_error( $validated ) ) {
			return $validated;
		}

		$email_owner = email_exists( $validated['email'] );
		if ( $email_owner && (int) $email_owner !== (int) $user_id ) {
			return self::validation_error( 'That email address is already in use.' );
		}

		$sync_billing   = metadata_exists( 'user', $user_id, 'billing_phone' );
		$meta_keys      = array( 'mrc_phone' );
		if ( $sync_billing ) {
			$meta_keys[] = 'billing_phone';
		}
		$meta_snapshots = self::snapshot_user_meta( $user_id, $meta_keys );
		$core_snapshot  = array(
			'first_name'   => (string) $user->first_name,
			'last_name'    => (string) $user->last_name,
			'display_name' => (string) $user->display_name,
			'user_email'   => (string) $user->user_email,
		);

		if ( ! self::persist_user_meta( $user_id, 'mrc_phone', $validated['phone'] ) ) {
			self::restore_user_meta( $user_id, $meta_snapshots );
			return self::storage_error();
		}
		if ( $sync_billing && ! self::persist_user_meta( $user_id, 'billing_phone', $validated['phone'] ) ) {
			self::restore_user_meta( $user_id, $meta_snapshots );
			return self::storage_error();
		}

		$updated = wp_update_user(
			array(
				'ID'           => $user_id,
				'first_name'   => $validated['firstName'],
				'last_name'    => $validated['lastName'],
				'display_name' => $validated['displayName'],
				'user_email'   => $validated['email'],
			)
		);
		if ( is_wp_error( $updated ) || ! $updated ) {
			self::restore_user_meta( $user_id, $meta_snapshots );
			self::restore_core_user_fields( $user_id, $core_snapshot );
			if (
				! self::meta_matches_snapshot( $user_id, $meta_snapshots ) ||
				! self::core_user_matches( $user_id, $core_snapshot )
			) {
				return self::storage_error();
			}
			return self::update_error();
		}

		$refreshed = get_userdata( $user_id );
		if ( ! $refreshed instanceof WP_User ) {
			self::restore_user_meta( $user_id, $meta_snapshots );
			self::restore_core_user_fields( $user_id, $core_snapshot );
			return self::storage_error();
		}

		return new WP_REST_Response( self::profile_data( $refreshed ), 200 );
	}

	/**
	 * Capture whether each meta key exists and its current value.
	 *
	 * @param int                $user_id User ID.
	 * @param array<int, string> $keys    Meta keys to snapshot.
	 * @return array<string, array{exists: bool, value?: string}>
	 */
	private static function snapshot_user_meta( int $user_id, array $keys ): array {
		$snapshots = array();
		foreach ( $keys as $key ) {
			if ( metadata_exists( 'user', $user_id, $key ) ) {
				$value             = get_user_meta( $user_id, $key, true );
				$snapshots[ $key ] = array(
					'exists' => true,
					'value'  => is_scalar( $value ) ? (string) $value : '',
				);
			} else {
				$snapshots[ $key ] = array( 'exists' => false );
			}
		}
		return $snapshots;
	}

	/**
	 * Restore meta keys to their snapshotted existence and values.
	 *
	 * @param int                                           $user_id    User ID.
	 * @param array<string, array{exists: bool, value?: string}> $snapshots Snapshots.
	 */
	private static function restore_user_meta( int $user_id, array $snapshots ): void {
		foreach ( $snapshots as $key => $snapshot ) {
			if ( ! empty( $snapshot['exists'] ) ) {
				update_user_meta( $user_id, $key, (string) $snapshot['value'] );
			} elseif ( metadata_exists( 'user', $user_id, $key ) ) {
				delete_user_meta( $user_id, $key );
			}
		}
	}

	/**
	 * Best-effort restore of core profile fields after a failed update.
	 *
	 * @param int                   $user_id  User ID.
	 * @param array<string, string> $snapshot Original core fields.
	 */
	private static function restore_core_user_fields( int $user_id, array $snapshot ): void {
		wp_update_user(
			array(
				'ID'           => $user_id,
				'first_name'   => $snapshot['first_name'],
				'last_name'    => $snapshot['last_name'],
				'display_name' => $snapshot['display_name'],
				'user_email'   => $snapshot['user_email'],
			)
		);
	}

	/**
	 * @param int                                           $user_id    User ID.
	 * @param array<string, array{exists: bool, value?: string}> $snapshots Snapshots.
	 */
	private static function meta_matches_snapshot( int $user_id, array $snapshots ): bool {
		foreach ( $snapshots as $key => $snapshot ) {
			$exists = metadata_exists( 'user', $user_id, $key );
			if ( ! empty( $snapshot['exists'] ) ) {
				if ( ! $exists ) {
					return false;
				}
				$value = get_user_meta( $user_id, $key, true );
				if ( (string) ( is_scalar( $value ) ? $value : '' ) !== (string) $snapshot['value'] ) {
					return false;
				}
			} elseif ( $exists ) {
				return false;
			}
		}
		return true;
	}

	/**
	 * @param int                   $user_id  User ID.
	 * @param array<string, string> $snapshot Original core fields.
	 */
	private static function core_user_matches( int $user_id, array $snapshot ): bool {
		$user = get_userdata( $user_id );
		if ( ! $user instanceof WP_User ) {
			return false;
		}

		return (string) $user->first_name === $snapshot['first_name']
			&& (string) $user->last_name === $snapshot['last_name']
			&& (string) $user->display_name === $snapshot['display_name']
			&& (string) $user->user_email === $snapshot['user_email'];
	}

	/**
	 * Map a WordPress user and supported metadata to the public profile contract.
	 *
	 * @param WP_User $user WordPress user.
	 * @return array<string, int|string>
	 */
	public static function profile_data( WP_User $user ): array {
		return array(
			'id'           => (int) $user->ID,
			'username'     => (string) $user->user_login,
			'firstName'    => (string) $user->first_name,
			'lastName'     => (string) $user->last_name,
			'displayName'  => (string) $user->display_name,
			'email'        => (string) $user->user_email,
			'phone'        => self::phone_meta_value( (int) $user->ID ),
			'membershipId' => self::first_meta_value(
				(int) $user->ID,
				array( 'mrc_membership_id', 'membership_id', 'membership_number' )
			),
		);
	}

	/**
	 * Normalize and validate the complete editable profile payload.
	 *
	 * @param array $input Raw profile fields.
	 * @return array<string, string>|WP_Error
	 */
	public static function validate_update( array $input ) {
		$first_name   = self::text( $input, 'firstName', self::LEN_NAME );
		$last_name    = self::text( $input, 'lastName', self::LEN_NAME );
		$display_name = self::text( $input, 'displayName', self::LEN_DISPLAY );
		$email        = self::text( $input, 'email', self::LEN_EMAIL );
		$phone        = self::text( $input, 'phone', self::LEN_PHONE );

		foreach ( array( $first_name, $last_name, $display_name, $email, $phone ) as $value ) {
			if ( is_wp_error( $value ) ) {
				return $value;
			}
		}

		if ( '' === $first_name ) {
			return self::validation_error( 'First name is required.' );
		}
		if ( '' === $last_name ) {
			return self::validation_error( 'Last name is required.' );
		}
		if ( '' === $display_name ) {
			return self::validation_error( 'Display name is required.' );
		}
		if ( '' === $email || ! filter_var( $email, FILTER_VALIDATE_EMAIL ) ) {
			return self::validation_error( 'A valid email address is required.' );
		}

		return array(
			'firstName'   => $first_name,
			'lastName'    => $last_name,
			'displayName' => $display_name,
			'email'       => $email,
			'phone'       => $phone,
		);
	}

	/**
	 * Persist user meta while accepting WordPress's false result for no change.
	 *
	 * @param int    $user_id User ID.
	 * @param string $key     Meta key.
	 * @param string $value   Intended value.
	 */
	public static function persist_user_meta( int $user_id, string $key, string $value ): bool {
		$result = update_user_meta( $user_id, $key, $value );
		if ( is_wp_error( $result ) ) {
			return false;
		}
		if ( false !== $result ) {
			return true;
		}
		if ( ! metadata_exists( 'user', $user_id, $key ) ) {
			return false;
		}

		return (string) get_user_meta( $user_id, $key, true ) === $value;
	}

	/**
	 * Return canonical phone metadata when present, including an empty value.
	 *
	 * Legacy values are consulted only until mrc_phone has been created.
	 *
	 * @param int $user_id User ID.
	 */
	private static function phone_meta_value( int $user_id ): string {
		if ( metadata_exists( 'user', $user_id, 'mrc_phone' ) ) {
			$value = get_user_meta( $user_id, 'mrc_phone', true );
			return is_scalar( $value ) ? (string) $value : '';
		}

		return self::first_meta_value( $user_id, array( 'billing_phone', 'phone' ) );
	}

	/**
	 * Return the first non-empty value from an ordered user-meta fallback list.
	 *
	 * @param int                $user_id User ID.
	 * @param array<int, string> $keys    Ordered meta keys.
	 */
	private static function first_meta_value( int $user_id, array $keys ): string {
		foreach ( $keys as $key ) {
			$value = get_user_meta( $user_id, $key, true );
			if ( is_scalar( $value ) && '' !== trim( (string) $value ) ) {
				return (string) $value;
			}
		}

		return '';
	}

	/**
	 * @param array  $input Source values.
	 * @param string $key   Field key.
	 * @param int    $max   Maximum character length.
	 * @return string|WP_Error
	 */
	private static function text( array $input, string $key, int $max ) {
		if ( ! array_key_exists( $key, $input ) || null === $input[ $key ] ) {
			$value = '';
		} elseif ( ! is_scalar( $input[ $key ] ) ) {
			return self::validation_error( sprintf( 'Invalid value for %s.', $key ) );
		} else {
			$value = sanitize_text_field( (string) $input[ $key ] );
		}

		if ( self::character_length( $value ) > $max ) {
			return self::validation_error( sprintf( '%s exceeds the maximum length of %d characters.', $key, $max ) );
		}

		return $value;
	}

	/**
	 * Count UTF-8 characters with a dependency-free fallback.
	 *
	 * @param string $value Text to measure.
	 */
	private static function character_length( string $value ): int {
		if ( function_exists( 'mb_strlen' ) ) {
			return mb_strlen( $value, 'UTF-8' );
		}

		$count = preg_match_all( '/./us', $value, $matches );
		return false === $count ? strlen( $value ) : $count;
	}

	/**
	 * @param string $message Safe client-facing message.
	 */
	private static function validation_error( string $message ): WP_Error {
		return new WP_Error( 'mrc_profile_validation_error', $message, array( 'status' => 422 ) );
	}

	/**
	 * Map WordPress uniqueness and user-update failures to a safe response.
	 */
	private static function update_error(): WP_Error {
		return new WP_Error(
			'mrc_profile_update_error',
			'The profile details could not be updated. Check the email address and try again.',
			array( 'status' => 422 )
		);
	}

	/**
	 * Return a generic persistence error without exposing internals.
	 */
	private static function storage_error(): WP_Error {
		return new WP_Error(
			'mrc_profile_storage_error',
			'The profile could not be saved. Please try again.',
			array( 'status' => 500 )
		);
	}
}
