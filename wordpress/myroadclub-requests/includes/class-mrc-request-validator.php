<?php
/**
 * Payload normalization and validation for ticket and roadside requests.
 *
 * @package MyRoadClub_Requests
 */

/**
 * Validates and normalizes request payloads from the Next.js forms.
 */
class MRC_Request_Validator {

	private const SERVICE_TYPES = array(
		'jump-start',
		'flat-tire',
		'fuel',
		'lockout',
		'winch',
		'towing',
		'battery',
		'other',
	);

	private const VIOLATION_TYPES = array(
		'',
		'Speeding',
		'Parking',
		'Red light / stop sign',
		'HOV / carpool',
		'Registration / plates',
		'Cell phone / distracted',
		'Other',
	);

	private const PASSENGERS = array( '', '0', '1', '2', '3', '4', '5', '6', '7', '8+' );

	private const DRIVE_TYPES = array( '', 'FWD', 'RWD', 'AWD', '4WD', 'Other' );

	private const LEN_SHORT   = 100;
	private const LEN_MEDIUM  = 255;
	private const LEN_LONG    = 2000;
	private const LEN_STATE   = 64;
	private const LEN_ZIP     = 20;
	private const LEN_PHONE   = 40;
	private const LEN_EMAIL   = 254;
	private const LEN_YEAR    = 4;
	private const LEN_VIN     = 32;
	private const LEN_PLATE   = 32;

	/**
	 * Validate a ticket request payload.
	 *
	 * @param array $input Raw ticket fields.
	 * @return array|WP_Error Normalized payload or validation error.
	 */
	public static function ticket( array $input ) {
		$citation_number = self::text( $input, 'citationNumber', self::LEN_SHORT );
		$violation_date  = self::optional_date( $input, 'violationDate' );
		$state           = self::text( $input, 'state', self::LEN_STATE );
		$city            = self::text( $input, 'city', self::LEN_MEDIUM );
		$violation_type  = self::text( $input, 'violationType', self::LEN_MEDIUM );
		$description     = self::text( $input, 'description', self::LEN_LONG );
		$court_date      = self::optional_date( $input, 'courtDate' );
		$first_name      = self::text( $input, 'firstName', self::LEN_SHORT );
		$last_name       = self::text( $input, 'lastName', self::LEN_SHORT );
		$phone           = self::text( $input, 'phone', self::LEN_PHONE );
		$email           = self::text( $input, 'email', self::LEN_EMAIL );

		if ( is_wp_error( $citation_number ) ) {
			return $citation_number;
		}
		if ( is_wp_error( $violation_date ) ) {
			return $violation_date;
		}
		if ( is_wp_error( $state ) ) {
			return $state;
		}
		if ( is_wp_error( $city ) ) {
			return $city;
		}
		if ( is_wp_error( $violation_type ) ) {
			return $violation_type;
		}
		if ( is_wp_error( $description ) ) {
			return $description;
		}
		if ( is_wp_error( $court_date ) ) {
			return $court_date;
		}
		if ( is_wp_error( $first_name ) ) {
			return $first_name;
		}
		if ( is_wp_error( $last_name ) ) {
			return $last_name;
		}
		if ( is_wp_error( $phone ) ) {
			return $phone;
		}
		if ( is_wp_error( $email ) ) {
			return $email;
		}

		if ( '' === $first_name ) {
			return self::error( 'First name is required.' );
		}
		if ( '' === $last_name ) {
			return self::error( 'Last name is required.' );
		}
		if ( '' === $phone ) {
			return self::error( 'Phone is required.' );
		}
		if ( ! in_array( $violation_type, self::VIOLATION_TYPES, true ) ) {
			return self::error( 'Invalid violation type.' );
		}
		if ( '' !== $email ) {
			$validated_email = self::validate_email( $email );
			if ( is_wp_error( $validated_email ) ) {
				return $validated_email;
			}
			$email = $validated_email;
		}

		return array(
			'citationNumber' => $citation_number,
			'violationDate'  => $violation_date,
			'state'          => $state,
			'city'           => $city,
			'violationType'  => $violation_type,
			'description'    => $description,
			'courtDate'      => $court_date,
			'firstName'      => $first_name,
			'lastName'       => $last_name,
			'phone'          => $phone,
			'email'          => $email,
		);
	}

	/**
	 * Validate a roadside assistance request payload.
	 *
	 * @param array $input Raw roadside fields.
	 * @return array|WP_Error Normalized payload or validation error.
	 */
	public static function roadside( array $input ) {
		$service_type    = self::text( $input, 'serviceType', self::LEN_SHORT );
		$service_details = self::text( $input, 'serviceDetails', self::LEN_LONG );

		if ( is_wp_error( $service_type ) ) {
			return $service_type;
		}
		if ( is_wp_error( $service_details ) ) {
			return $service_details;
		}
		if ( ! in_array( $service_type, self::SERVICE_TYPES, true ) ) {
			return self::error( 'Invalid service type.' );
		}

		$customer = self::object( $input, 'customer' );
		$vehicle  = self::object( $input, 'vehicle' );
		$location = self::object( $input, 'serviceLocation' );
		$drop_off = self::object( $input, 'dropOff' );
		$extra    = self::object( $input, 'additional' );

		$first_name    = self::text( $customer, 'firstName', self::LEN_SHORT );
		$last_name     = self::text( $customer, 'lastName', self::LEN_SHORT );
		$phone         = self::text( $customer, 'phone', self::LEN_PHONE );
		$email         = self::text( $customer, 'email', self::LEN_EMAIL );
		$is_member     = self::boolean( $customer, 'isMember', false );
		$account_name  = self::text( $customer, 'accountName', self::LEN_MEDIUM );
		$membership_id = self::text( $customer, 'membershipId', self::LEN_SHORT );

		foreach ( array( $first_name, $last_name, $phone, $email, $is_member, $account_name, $membership_id ) as $value ) {
			if ( is_wp_error( $value ) ) {
				return $value;
			}
		}

		if ( '' === $first_name ) {
			return self::error( 'First name is required.' );
		}
		if ( '' === $last_name ) {
			return self::error( 'Last name is required.' );
		}
		if ( '' === $phone ) {
			return self::error( 'Phone is required.' );
		}
		if ( '' !== $email ) {
			$email = self::validate_email( $email );
			if ( is_wp_error( $email ) ) {
				return $email;
			}
		}

		if ( ! $is_member ) {
			$account_name  = '';
			$membership_id = '';
		}

		$year          = self::text( $vehicle, 'year', self::LEN_YEAR );
		$make          = self::text( $vehicle, 'make', self::LEN_SHORT );
		$model         = self::text( $vehicle, 'model', self::LEN_SHORT );
		$color         = self::text( $vehicle, 'color', self::LEN_SHORT );
		$vin           = self::text( $vehicle, 'vin', self::LEN_VIN );
		$plate         = self::text( $vehicle, 'plate', self::LEN_PLATE );
		$safe_location = self::boolean( $vehicle, 'safeLocation', true );

		foreach ( array( $year, $make, $model, $color, $vin, $plate, $safe_location ) as $value ) {
			if ( is_wp_error( $value ) ) {
				return $value;
			}
		}
		if ( '' !== $year && ! preg_match( '/^\d{4}$/', $year ) ) {
			return self::error( 'Invalid vehicle year.' );
		}

		$address = self::text( $location, 'address', self::LEN_MEDIUM );
		$city    = self::text( $location, 'city', self::LEN_MEDIUM );
		$state   = self::text( $location, 'state', self::LEN_STATE );
		$zip     = self::text( $location, 'zip', self::LEN_ZIP );
		$lat     = self::optional_coordinate( $location, 'lat' );
		$lng     = self::optional_coordinate( $location, 'lng' );

		foreach ( array( $address, $city, $state, $zip, $lat, $lng ) as $value ) {
			if ( is_wp_error( $value ) ) {
				return $value;
			}
		}

		$passengers   = self::text( $extra, 'passengers', self::LEN_SHORT );
		$drive_type   = self::text( $extra, 'driveType', self::LEN_SHORT );
		$with_vehicle = self::boolean( $extra, 'withVehicle', true );

		foreach ( array( $passengers, $drive_type, $with_vehicle ) as $value ) {
			if ( is_wp_error( $value ) ) {
				return $value;
			}
		}
		if ( ! in_array( $passengers, self::PASSENGERS, true ) ) {
			return self::error( 'Invalid passenger count.' );
		}
		if ( ! in_array( $drive_type, self::DRIVE_TYPES, true ) ) {
			return self::error( 'Invalid drive type.' );
		}

		$normalized_drop_off = null;
		if ( 'towing' === $service_type ) {
			$drop_address = self::text( $drop_off, 'address', self::LEN_MEDIUM );
			$drop_city    = self::text( $drop_off, 'city', self::LEN_MEDIUM );
			$drop_state   = self::text( $drop_off, 'state', self::LEN_STATE );
			$drop_zip     = self::text( $drop_off, 'zip', self::LEN_ZIP );
			$drop_lat     = self::optional_coordinate( $drop_off, 'lat' );
			$drop_lng     = self::optional_coordinate( $drop_off, 'lng' );

			foreach ( array( $drop_address, $drop_city, $drop_state, $drop_zip, $drop_lat, $drop_lng ) as $value ) {
				if ( is_wp_error( $value ) ) {
					return $value;
				}
			}

			$normalized_drop_off = array(
				'address' => $drop_address,
				'city'    => $drop_city,
				'state'   => $drop_state,
				'zip'     => $drop_zip,
				'lat'     => $drop_lat,
				'lng'     => $drop_lng,
			);
		}

		return array(
			'serviceType'     => $service_type,
			'serviceDetails'  => $service_details,
			'customer'        => array(
				'firstName'    => $first_name,
				'lastName'     => $last_name,
				'phone'        => $phone,
				'email'        => $email,
				'isMember'     => $is_member,
				'accountName'  => $account_name,
				'membershipId' => $membership_id,
			),
			'vehicle'         => array(
				'year'         => $year,
				'make'         => $make,
				'model'        => $model,
				'color'        => $color,
				'vin'          => $vin,
				'plate'        => $plate,
				'safeLocation' => $safe_location,
			),
			'serviceLocation' => array(
				'address' => $address,
				'city'    => $city,
				'state'   => $state,
				'zip'     => $zip,
				'lat'     => $lat,
				'lng'     => $lng,
			),
			'dropOff'         => $normalized_drop_off,
			'additional'      => array(
				'passengers'  => $passengers,
				'driveType'   => $drive_type,
				'withVehicle' => $with_vehicle,
			),
		);
	}

	/**
	 * @param string $message Human-readable validation message.
	 * @return WP_Error
	 */
	private static function error( string $message ): WP_Error {
		return new WP_Error(
			'mrc_validation_error',
			$message,
			array( 'status' => 422 )
		);
	}

	/**
	 * @param array  $input Source array.
	 * @param string $key   Nested object key.
	 * @return array
	 */
	private static function object( array $input, string $key ): array {
		if ( ! isset( $input[ $key ] ) || ! is_array( $input[ $key ] ) ) {
			return array();
		}
		return $input[ $key ];
	}

	/**
	 * @param array  $input  Source array.
	 * @param string $key    Field key.
	 * @param int    $max    Max length.
	 * @return string|WP_Error
	 */
	private static function text( array $input, string $key, int $max ) {
		if ( ! array_key_exists( $key, $input ) || null === $input[ $key ] ) {
			return '';
		}
		if ( ! is_scalar( $input[ $key ] ) ) {
			return self::error( sprintf( 'Invalid value for %s.', $key ) );
		}
		$value = trim( (string) $input[ $key ] );
		if ( function_exists( 'sanitize_text_field' ) && self::LEN_LONG !== $max ) {
			$value = sanitize_text_field( $value );
		} elseif ( function_exists( 'sanitize_textarea_field' ) && self::LEN_LONG === $max ) {
			$value = sanitize_textarea_field( $value );
		}
		if ( strlen( $value ) > $max ) {
			return self::error( sprintf( '%s exceeds the maximum length of %d characters.', $key, $max ) );
		}
		return $value;
	}

	/**
	 * @param array  $input Source array.
	 * @param string $key   Field key.
	 * @return string|WP_Error Empty string or YYYY-MM-DD.
	 */
	private static function optional_date( array $input, string $key ) {
		$value = self::text( $input, $key, 10 );
		if ( is_wp_error( $value ) ) {
			return $value;
		}
		if ( '' === $value ) {
			return '';
		}
		$dt = DateTimeImmutable::createFromFormat( 'Y-m-d', $value );
		$errors = DateTimeImmutable::getLastErrors();
		if ( ! $dt || ( is_array( $errors ) && ( $errors['warning_count'] > 0 || $errors['error_count'] > 0 ) ) ) {
			return self::error( sprintf( 'Invalid date for %s.', $key ) );
		}
		if ( $dt->format( 'Y-m-d' ) !== $value ) {
			return self::error( sprintf( 'Invalid date for %s.', $key ) );
		}
		return $value;
	}

	/**
	 * @param string $email Candidate email.
	 * @return string|WP_Error
	 */
	private static function validate_email( string $email ) {
		if ( function_exists( 'sanitize_email' ) ) {
			$email = sanitize_email( $email );
		}
		if ( ! filter_var( $email, FILTER_VALIDATE_EMAIL ) ) {
			return self::error( 'Invalid email address.' );
		}
		return $email;
	}

	/**
	 * @param array  $input   Source array.
	 * @param string $key     Field key.
	 * @param bool   $default Default when absent.
	 * @return bool|WP_Error
	 */
	private static function boolean( array $input, string $key, bool $default ) {
		if ( ! array_key_exists( $key, $input ) || null === $input[ $key ] ) {
			return $default;
		}
		$value = $input[ $key ];
		if ( is_bool( $value ) ) {
			return $value;
		}
		if ( 1 === $value || '1' === $value || 'true' === $value ) {
			return true;
		}
		if ( 0 === $value || '0' === $value || 'false' === $value ) {
			return false;
		}
		return self::error( sprintf( 'Invalid boolean for %s.', $key ) );
	}

	/**
	 * @param array  $input Source array.
	 * @param string $key   Field key.
	 * @return float|null|WP_Error
	 */
	private static function optional_coordinate( array $input, string $key ) {
		if ( ! array_key_exists( $key, $input ) || null === $input[ $key ] || '' === $input[ $key ] ) {
			return null;
		}
		if ( ! is_numeric( $input[ $key ] ) ) {
			return self::error( sprintf( 'Invalid coordinate for %s.', $key ) );
		}
		$value = (float) $input[ $key ];
		if ( 'lat' === $key && ( $value < -90 || $value > 90 ) ) {
			return self::error( 'Latitude out of range.' );
		}
		if ( 'lng' === $key && ( $value < -180 || $value > 180 ) ) {
			return self::error( 'Longitude out of range.' );
		}
		return $value;
	}
}

if ( ! function_exists( 'is_wp_error' ) ) {
	/**
	 * @param mixed $thing Value to check.
	 */
	function is_wp_error( $thing ): bool {
		return $thing instanceof WP_Error;
	}
}
