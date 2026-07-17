<?php
/**
 * Registers private request post types and their meta keys.
 *
 * @package MyRoadClub_Requests
 */

/**
 * Custom post types and meta for ticket and roadside requests.
 */
class MRC_Request_Post_Types {

	public const TICKET_POST_TYPE   = 'mrc_ticket_request';
	public const ROADSIDE_POST_TYPE = 'mrc_roadside_request';

	/**
	 * Hook CPT and meta registration.
	 */
	public static function register(): void {
		add_action( 'init', array( __CLASS__, 'register_post_types' ) );
		add_action( 'init', array( __CLASS__, 'register_meta' ) );
	}

	/**
	 * Register both private request post types.
	 */
	public static function register_post_types(): void {
		$shared = array(
			'public'              => false,
			'publicly_queryable'  => false,
			'exclude_from_search' => true,
			'show_ui'             => true,
			'show_in_menu'        => true,
			'show_in_rest'        => false,
			'capability_type'     => 'post',
			'map_meta_cap'        => true,
			'hierarchical'        => false,
			'supports'            => array( 'title', 'author' ),
			'has_archive'         => false,
			'rewrite'             => false,
			'query_var'           => false,
		);

		register_post_type(
			self::TICKET_POST_TYPE,
			array_merge(
				$shared,
				array(
					'labels' => array(
						'name'          => 'Ticket Requests',
						'singular_name' => 'Ticket Request',
						'menu_name'     => 'Ticket Requests',
						'edit_item'     => 'Edit Ticket Request',
						'search_items'  => 'Search Ticket Requests',
						'not_found'     => 'No ticket requests found.',
					),
					'menu_icon' => 'dashicons-tickets-alt',
				)
			)
		);

		register_post_type(
			self::ROADSIDE_POST_TYPE,
			array_merge(
				$shared,
				array(
					'labels' => array(
						'name'          => 'Roadside Requests',
						'singular_name' => 'Roadside Request',
						'menu_name'     => 'Roadside Requests',
						'edit_item'     => 'Edit Roadside Request',
						'search_items'  => 'Search Roadside Requests',
						'not_found'     => 'No roadside requests found.',
					),
					'menu_icon' => 'dashicons-car',
				)
			)
		);
	}

	/**
	 * Register all approved request meta keys.
	 */
	public static function register_meta(): void {
		$ticket_keys = array(
			'_mrc_citation_number'     => 'string',
			'_mrc_violation_date'      => 'string',
			'_mrc_violation_state'     => 'string',
			'_mrc_violation_city'      => 'string',
			'_mrc_violation_type'      => 'string',
			'_mrc_ticket_description'  => 'textarea',
			'_mrc_court_date'          => 'string',
			'_mrc_customer_first_name' => 'string',
			'_mrc_customer_last_name'  => 'string',
			'_mrc_customer_phone'      => 'string',
			'_mrc_customer_email'      => 'string',
			'_mrc_attachment_ids'      => 'array',
		);

		$roadside_keys = array(
			'_mrc_service_type'          => 'string',
			'_mrc_service_details'       => 'textarea',
			'_mrc_customer_first_name'   => 'string',
			'_mrc_customer_last_name'    => 'string',
			'_mrc_customer_phone'        => 'string',
			'_mrc_customer_email'        => 'string',
			'_mrc_is_member'             => 'boolean',
			'_mrc_account_name'          => 'string',
			'_mrc_membership_id'         => 'string',
			'_mrc_vehicle_year'          => 'string',
			'_mrc_vehicle_make'          => 'string',
			'_mrc_vehicle_model'         => 'string',
			'_mrc_vehicle_color'         => 'string',
			'_mrc_vehicle_vin'           => 'string',
			'_mrc_vehicle_plate'         => 'string',
			'_mrc_vehicle_safe_location' => 'boolean',
			'_mrc_service_address'       => 'string',
			'_mrc_service_city'          => 'string',
			'_mrc_service_state'         => 'string',
			'_mrc_service_zip'           => 'string',
			'_mrc_service_lat'           => 'number',
			'_mrc_service_lng'           => 'number',
			'_mrc_dropoff_address'       => 'string',
			'_mrc_dropoff_city'          => 'string',
			'_mrc_dropoff_state'         => 'string',
			'_mrc_dropoff_zip'           => 'string',
			'_mrc_dropoff_lat'           => 'number',
			'_mrc_dropoff_lng'           => 'number',
			'_mrc_passengers'            => 'string',
			'_mrc_drive_type'            => 'string',
			'_mrc_with_vehicle'          => 'boolean',
		);

		foreach ( $ticket_keys as $key => $type ) {
			self::register_meta_key( self::TICKET_POST_TYPE, $key, $type );
		}
		foreach ( $roadside_keys as $key => $type ) {
			self::register_meta_key( self::ROADSIDE_POST_TYPE, $key, $type );
		}
	}

	/**
	 * @param string $post_type Post type name.
	 * @param string $meta_key  Meta key.
	 * @param string $type      Meta type: string|textarea|boolean|number|array.
	 */
	private static function register_meta_key( string $post_type, string $meta_key, string $type ): void {
		$wp_type = ( 'textarea' === $type ) ? 'string' : $type;
		$args    = array(
			'type'          => $wp_type,
			'single'        => true,
			'show_in_rest'  => false,
			'auth_callback' => static function (): bool {
				return current_user_can( 'edit_posts' );
			},
		);

		switch ( $type ) {
			case 'boolean':
				$args['sanitize_callback'] = array( __CLASS__, 'sanitize_boolean' );
				$args['default']           = false;
				break;
			case 'number':
				$args['sanitize_callback'] = array( __CLASS__, 'sanitize_number' );
				break;
			case 'array':
				$args['sanitize_callback'] = array( __CLASS__, 'sanitize_id_array' );
				$args['default']           = array();
				break;
			case 'textarea':
				$args['sanitize_callback'] = array( __CLASS__, 'sanitize_textarea' );
				$args['default']           = '';
				break;
			default:
				$args['sanitize_callback'] = array( __CLASS__, 'sanitize_string' );
				$args['default']           = '';
				break;
		}

		register_post_meta( $post_type, $meta_key, $args );
	}

	/**
	 * @param mixed $value Raw meta value.
	 */
	public static function sanitize_string( $value ): string {
		if ( is_array( $value ) || is_object( $value ) ) {
			return '';
		}
		return sanitize_text_field( (string) $value );
	}

	/**
	 * @param mixed $value Raw meta value.
	 */
	public static function sanitize_textarea( $value ): string {
		if ( is_array( $value ) || is_object( $value ) ) {
			return '';
		}
		return sanitize_textarea_field( (string) $value );
	}

	/**
	 * @param mixed $value Raw meta value.
	 */
	public static function sanitize_boolean( $value ): bool {
		return (bool) $value;
	}

	/**
	 * @param mixed $value Raw meta value.
	 * @return float|string Empty string when cleared, otherwise float.
	 */
	public static function sanitize_number( $value ) {
		if ( null === $value || '' === $value ) {
			return '';
		}
		return is_numeric( $value ) ? (float) $value : '';
	}

	/**
	 * @param mixed $value Raw meta value.
	 * @return array<int, int>
	 */
	public static function sanitize_id_array( $value ): array {
		if ( ! is_array( $value ) ) {
			return array();
		}
		$ids = array();
		foreach ( $value as $item ) {
			$id = absint( $item );
			if ( $id > 0 ) {
				$ids[] = $id;
			}
		}
		return array_values( array_unique( $ids ) );
	}
}
