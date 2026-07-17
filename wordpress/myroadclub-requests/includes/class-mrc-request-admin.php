<?php
/**
 * Read-only WordPress admin views for stored requests.
 *
 * @package MyRoadClub_Requests
 */

/**
 * Customizes request list tables and request detail screens.
 */
class MRC_Request_Admin {

	/**
	 * Register admin list and metabox hooks.
	 */
	public static function register(): void {
		add_filter(
			'manage_' . MRC_Request_Post_Types::TICKET_POST_TYPE . '_posts_columns',
			array( __CLASS__, 'columns' )
		);
		add_filter(
			'manage_' . MRC_Request_Post_Types::ROADSIDE_POST_TYPE . '_posts_columns',
			array( __CLASS__, 'columns' )
		);
		add_action(
			'manage_' . MRC_Request_Post_Types::TICKET_POST_TYPE . '_posts_custom_column',
			array( __CLASS__, 'render_ticket_column' ),
			10,
			2
		);
		add_action(
			'manage_' . MRC_Request_Post_Types::ROADSIDE_POST_TYPE . '_posts_custom_column',
			array( __CLASS__, 'render_roadside_column' ),
			10,
			2
		);
		add_action( 'add_meta_boxes', array( __CLASS__, 'add_meta_boxes' ) );
	}

	/**
	 * Replace the default list table columns.
	 *
	 * @param array<string, string> $columns Existing columns.
	 * @return array<string, string>
	 */
	public static function columns( array $columns ): array {
		return array(
			'cb'        => '<input type="checkbox" />',
			'reference' => 'Reference',
			'requester' => 'Requester',
			'phone'     => 'Phone',
			'type'      => 'Type',
			'status'    => 'Status',
			'date'      => 'Date',
		);
	}

	/**
	 * Render a ticket request list value.
	 *
	 * @param string $column  Column key.
	 * @param int    $post_id Request post ID.
	 */
	public static function render_ticket_column( string $column, int $post_id ): void {
		self::render_column( $column, $post_id, '_mrc_violation_type' );
	}

	/**
	 * Render a roadside request list value.
	 *
	 * @param string $column  Column key.
	 * @param int    $post_id Request post ID.
	 */
	public static function render_roadside_column( string $column, int $post_id ): void {
		self::render_column( $column, $post_id, '_mrc_service_type' );
	}

	/**
	 * Register one read-only details metabox per request type.
	 */
	public static function add_meta_boxes(): void {
		add_meta_box(
			'mrc-ticket-request-details',
			'Request Details',
			array( __CLASS__, 'render_ticket_details' ),
			MRC_Request_Post_Types::TICKET_POST_TYPE,
			'normal',
			'high'
		);
		add_meta_box(
			'mrc-roadside-request-details',
			'Request Details',
			array( __CLASS__, 'render_roadside_details' ),
			MRC_Request_Post_Types::ROADSIDE_POST_TYPE,
			'normal',
			'high'
		);
	}

	/**
	 * Render all ticket request details.
	 *
	 * @param WP_Post $post Request post.
	 */
	public static function render_ticket_details( WP_Post $post ): void {
		$rows = array(
			array( 'Reference', get_the_title( $post->ID ) ),
			array( 'Requester', self::requester_name( $post->ID ) ),
			array( 'Phone', self::meta( $post->ID, '_mrc_customer_phone' ) ),
			array( 'Email', self::meta( $post->ID, '_mrc_customer_email' ) ),
			array( 'Citation number', self::meta( $post->ID, '_mrc_citation_number' ) ),
			array( 'Violation date', self::meta( $post->ID, '_mrc_violation_date' ) ),
			array( 'Violation state', self::meta( $post->ID, '_mrc_violation_state' ) ),
			array( 'Violation city', self::meta( $post->ID, '_mrc_violation_city' ) ),
			array( 'Violation type', self::meta( $post->ID, '_mrc_violation_type' ) ),
			array( 'Description', self::meta( $post->ID, '_mrc_ticket_description' ), true ),
			array( 'Court date', self::meta( $post->ID, '_mrc_court_date' ) ),
			array( 'Status', self::status_label( $post ) ),
		);

		self::table_start();
		foreach ( $rows as $row ) {
			self::render_row( $row[0], $row[1], ! empty( $row[2] ) );
		}
		self::render_attachments( $post->ID );
		self::table_end();
	}

	/**
	 * Render all roadside request details.
	 *
	 * @param WP_Post $post Request post.
	 */
	public static function render_roadside_details( WP_Post $post ): void {
		$rows = array(
			array( 'Reference', get_the_title( $post->ID ) ),
			array( 'Service type', self::meta( $post->ID, '_mrc_service_type' ) ),
			array( 'Service details', self::meta( $post->ID, '_mrc_service_details' ), true ),
			array( 'Requester', self::requester_name( $post->ID ) ),
			array( 'Phone', self::meta( $post->ID, '_mrc_customer_phone' ) ),
			array( 'Email', self::meta( $post->ID, '_mrc_customer_email' ) ),
			array( 'Member', self::boolean_label( self::meta( $post->ID, '_mrc_is_member' ) ) ),
			array( 'Account name', self::meta( $post->ID, '_mrc_account_name' ) ),
			array( 'Membership ID', self::meta( $post->ID, '_mrc_membership_id' ) ),
			array( 'Vehicle year', self::meta( $post->ID, '_mrc_vehicle_year' ) ),
			array( 'Vehicle make', self::meta( $post->ID, '_mrc_vehicle_make' ) ),
			array( 'Vehicle model', self::meta( $post->ID, '_mrc_vehicle_model' ) ),
			array( 'Vehicle color', self::meta( $post->ID, '_mrc_vehicle_color' ) ),
			array( 'VIN', self::meta( $post->ID, '_mrc_vehicle_vin' ) ),
			array( 'License plate', self::meta( $post->ID, '_mrc_vehicle_plate' ) ),
			array( 'Vehicle in safe location', self::boolean_label( self::meta( $post->ID, '_mrc_vehicle_safe_location' ) ) ),
			array( 'Service address', self::meta( $post->ID, '_mrc_service_address' ) ),
			array( 'Service city', self::meta( $post->ID, '_mrc_service_city' ) ),
			array( 'Service state', self::meta( $post->ID, '_mrc_service_state' ) ),
			array( 'Service ZIP', self::meta( $post->ID, '_mrc_service_zip' ) ),
			array( 'Drop-off address', self::meta( $post->ID, '_mrc_dropoff_address' ) ),
			array( 'Drop-off city', self::meta( $post->ID, '_mrc_dropoff_city' ) ),
			array( 'Drop-off state', self::meta( $post->ID, '_mrc_dropoff_state' ) ),
			array( 'Drop-off ZIP', self::meta( $post->ID, '_mrc_dropoff_zip' ) ),
			array( 'Passengers', self::meta( $post->ID, '_mrc_passengers' ) ),
			array( 'Drive type', self::meta( $post->ID, '_mrc_drive_type' ) ),
			array( 'Staying with vehicle', self::boolean_label( self::meta( $post->ID, '_mrc_with_vehicle' ) ) ),
			array( 'Status', self::status_label( $post ) ),
		);

		self::table_start();
		foreach ( $rows as $row ) {
			self::render_row( $row[0], $row[1], ! empty( $row[2] ) );
		}
		self::render_map_row(
			'Service location map',
			self::meta( $post->ID, '_mrc_service_lat' ),
			self::meta( $post->ID, '_mrc_service_lng' )
		);
		self::render_map_row(
			'Drop-off map',
			self::meta( $post->ID, '_mrc_dropoff_lat' ),
			self::meta( $post->ID, '_mrc_dropoff_lng' )
		);
		self::table_end();
	}

	/**
	 * Render a shared list-table column.
	 *
	 * @param string $column   Column key.
	 * @param int    $post_id  Request post ID.
	 * @param string $type_key Meta key used by the type column.
	 */
	private static function render_column( string $column, int $post_id, string $type_key ): void {
		$value = '';

		switch ( $column ) {
			case 'reference':
				$value = get_the_title( $post_id );
				break;
			case 'requester':
				$value = self::requester_name( $post_id );
				break;
			case 'phone':
				$value = self::meta( $post_id, '_mrc_customer_phone' );
				break;
			case 'type':
				$value = self::meta( $post_id, $type_key );
				break;
			case 'status':
				$post  = get_post( $post_id );
				$value = $post instanceof WP_Post ? self::status_label( $post ) : '';
				break;
			case 'date':
				$value = get_the_date( get_option( 'date_format' ), $post_id );
				break;
			default:
				return;
		}

		echo esc_html( $value );
	}

	/**
	 * @param int    $post_id Request post ID.
	 * @param string $key     Meta key.
	 * @return mixed
	 */
	private static function meta( int $post_id, string $key ) {
		return get_post_meta( $post_id, $key, true );
	}

	/**
	 * @param int $post_id Request post ID.
	 */
	private static function requester_name( int $post_id ): string {
		$first = (string) self::meta( $post_id, '_mrc_customer_first_name' );
		$last  = (string) self::meta( $post_id, '_mrc_customer_last_name' );
		return trim( $first . ' ' . $last );
	}

	/**
	 * @param WP_Post $post Request post.
	 */
	private static function status_label( WP_Post $post ): string {
		$status = get_post_status_object( $post->post_status );
		return $status && isset( $status->label ) ? (string) $status->label : (string) $post->post_status;
	}

	/**
	 * @param mixed $value Stored boolean value.
	 */
	private static function boolean_label( $value ): string {
		return $value ? 'Yes' : 'No';
	}

	/**
	 * Start a details table.
	 */
	private static function table_start(): void {
		echo '<table class="widefat striped"><tbody>';
	}

	/**
	 * End a details table.
	 */
	private static function table_end(): void {
		echo '</tbody></table>';
	}

	/**
	 * Render an escaped detail row.
	 *
	 * @param string $label     Row label.
	 * @param mixed  $value     Row value.
	 * @param bool   $multiline Whether line breaks should be preserved.
	 */
	private static function render_row( string $label, $value, bool $multiline = false ): void {
		$escaped = esc_html( (string) $value );
		if ( $multiline ) {
			$escaped = nl2br( $escaped );
		}

		echo '<tr><th scope="row">' . esc_html( $label ) . '</th><td>' . $escaped . '</td></tr>';
	}

	/**
	 * Render a Google Maps link for a coordinate pair.
	 *
	 * @param string $label Row label.
	 * @param mixed  $lat   Latitude.
	 * @param mixed  $lng   Longitude.
	 */
	private static function render_map_row( string $label, $lat, $lng ): void {
		if ( '' === (string) $lat || '' === (string) $lng ) {
			return;
		}

		$url = add_query_arg(
			array(
				'api'   => 1,
				'query' => (string) $lat . ',' . (string) $lng,
			),
			'https://www.google.com/maps/search/'
		);

		echo '<tr><th scope="row">' . esc_html( $label ) . '</th><td><a href="' .
			esc_url( $url ) . '" target="_blank" rel="noopener noreferrer">' .
			esc_html( 'Open in Google Maps' ) . '</a></td></tr>';
	}

	/**
	 * Render links for saved ticket attachment IDs.
	 *
	 * @param int $post_id Ticket request post ID.
	 */
	private static function render_attachments( int $post_id ): void {
		$ids = self::meta( $post_id, '_mrc_attachment_ids' );
		if ( ! is_array( $ids ) || empty( $ids ) ) {
			self::render_row( 'Attachments', '' );
			return;
		}

		echo '<tr><th scope="row">' . esc_html( 'Attachments' ) . '</th><td><ul>';
		foreach ( $ids as $id ) {
			$link = wp_get_attachment_link( (int) $id );
			if ( $link ) {
				echo '<li>' . wp_kses_post( $link ) . '</li>';
			}
		}
		echo '</ul></td></tr>';
	}
}
