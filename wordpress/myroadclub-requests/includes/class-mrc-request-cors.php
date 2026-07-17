<?php
/**
 * Restricted CORS for the MyRoadClub REST namespace.
 *
 * @package MyRoadClub_Requests
 */

/**
 * Replaces WordPress core CORS headers only for plugin REST routes.
 */
class MRC_Request_CORS {

	private const ROUTE_PREFIX = '/myroadclub/v1/';

	/**
	 * Register the post-core REST response filter.
	 */
	public static function register(): void {
		add_filter( 'rest_pre_serve_request', array( __CLASS__, 'serve' ), 20, 4 );
	}

	/**
	 * Replace core REST CORS output for plugin namespace responses.
	 *
	 * @param bool            $served  Whether the response was served.
	 * @param WP_HTTP_Response $result Response object.
	 * @param WP_REST_Request $request Request object.
	 * @param WP_REST_Server  $server  REST server.
	 */
	public static function serve( $served, $result, WP_REST_Request $request, $server ) {
		$headers = self::headers_for_request( $request );
		if ( null === $headers ) {
			return $served;
		}

		header_remove( 'Access-Control-Allow-Origin' );
		header_remove( 'Access-Control-Allow-Headers' );
		header_remove( 'Access-Control-Allow-Methods' );

		foreach ( $headers as $name => $value ) {
			header( $name . ': ' . $value, true );
		}

		return $served;
	}

	/**
	 * Build exact CORS headers for an allowed namespace request.
	 *
	 * A null return means the route is outside this plugin's namespace. An
	 * empty array means the route is in scope but its origin is not allowed.
	 *
	 * @param WP_REST_Request $request REST request.
	 * @return array<string, string>|null
	 */
	public static function headers_for_request( WP_REST_Request $request ): ?array {
		if ( 0 !== strpos( $request->get_route(), self::ROUTE_PREFIX ) ) {
			return null;
		}

		$origin = $request->get_header( 'origin' );
		if ( ! is_string( $origin ) || ! in_array( $origin, self::allowed_origins(), true ) ) {
			return array();
		}

		return array(
			'Access-Control-Allow-Origin'  => $origin,
			'Vary'                         => 'Origin',
			'Access-Control-Allow-Headers' => 'Authorization, Content-Type',
			'Access-Control-Allow-Methods' => 'POST, OPTIONS',
		);
	}

	/**
	 * Return production and, at most, one configured development origin.
	 *
	 * @return array<int, string>
	 */
	private static function allowed_origins(): array {
		$development = defined( 'MRC_REQUESTS_DEV_ORIGIN' ) ? MRC_REQUESTS_DEV_ORIGIN : '';
		if ( ! is_string( $development ) ) {
			$development = '';
		}

		return array_values(
			array_unique(
				array_filter(
					array(
						'https://app.myroadclub.com',
						$development,
					)
				)
			)
		);
	}
}
