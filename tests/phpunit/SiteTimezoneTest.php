<?php
/**
 * Tests for API\resolve_site_timezone() — #681.
 *
 * The analytics chart buckets time in the site timezone. ClickHouse's
 * toStartOfInterval() only accepts named IANA zones, so a site configured with
 * a manual UTC offset must be applied as an explicit second-shift rather than
 * silently falling back to UTC (which lands the day boundary on UTC midnight,
 * not the site's). This pins the resolution that decides which strategy a given
 * WP timezone setting maps to. Pure option-reading — no ClickHouse needed.
 */

namespace Altis\Accelerate;

use Altis\Accelerate\API;
use WP_UnitTestCase;

class SiteTimezoneTest extends WP_UnitTestCase {

	public function tear_down() {
		update_option( 'timezone_string', '' );
		update_option( 'gmt_offset', 0 );
		parent::tear_down();
	}

	public function test_named_zone_uses_tz_name() {
		update_option( 'timezone_string', 'Australia/Sydney' );
		$this->assertSame(
			[ 'type' => 'name', 'value' => 'Australia/Sydney' ],
			API\resolve_site_timezone()
		);
	}

	public function test_whole_hour_offset_shifts_in_seconds() {
		update_option( 'timezone_string', '' );
		update_option( 'gmt_offset', 10 );
		$this->assertSame(
			[ 'type' => 'offset', 'value' => 36000 ],
			API\resolve_site_timezone()
		);
	}

	public function test_half_hour_offset() {
		update_option( 'timezone_string', '' );
		update_option( 'gmt_offset', 5.5 );
		$this->assertSame(
			[ 'type' => 'offset', 'value' => 19800 ],
			API\resolve_site_timezone()
		);
	}

	public function test_quarter_hour_offset() {
		update_option( 'timezone_string', '' );
		update_option( 'gmt_offset', 5.75 );
		$this->assertSame(
			[ 'type' => 'offset', 'value' => 20700 ],
			API\resolve_site_timezone()
		);
	}

	public function test_negative_offset() {
		update_option( 'timezone_string', '' );
		update_option( 'gmt_offset', -4.5 );
		$this->assertSame(
			[ 'type' => 'offset', 'value' => -16200 ],
			API\resolve_site_timezone()
		);
	}

	public function test_zero_offset_collapses_to_utc_name() {
		update_option( 'timezone_string', '' );
		update_option( 'gmt_offset', 0 );
		$this->assertSame(
			[ 'type' => 'name', 'value' => 'UTC' ],
			API\resolve_site_timezone()
		);
	}

	public function test_named_bucket_expr_uses_tz_param() {
		$site_tz = [ 'type' => 'name', 'value' => 'Australia/Sydney' ];
		$expr = API\build_time_bucket_expr( 'event_timestamp', '1 hour', $site_tz );
		$this->assertStringContainsString( '{tz:String}', $expr );
		$this->assertStringNotContainsString( 'addSeconds', $expr );
	}

	public function test_offset_bucket_expr_shifts_in_seconds() {
		$site_tz = [ 'type' => 'offset', 'value' => 36000 ];
		$expr = API\build_time_bucket_expr( 'event_timestamp', '1 hour', $site_tz );
		$this->assertStringContainsString( 'addSeconds(event_timestamp, {tz_offset:Int32})', $expr );
		$this->assertStringContainsString( "'UTC'", $expr );
	}

	/**
	 * The `date` label and the WITH FILL bounds must bucket with the SAME
	 * shift, or the fill grid lands off the labels by the offset at the range
	 * edges (#681). Assert the label column and the fill columns produce
	 * structurally identical expressions modulo the column argument.
	 */
	public function test_label_and_fill_fragments_share_shift() {
		foreach ( [
			[ 'type' => 'name', 'value' => 'Australia/Sydney' ],
			[ 'type' => 'offset', 'value' => 19800 ],
		] as $site_tz ) {
			$label = API\build_time_bucket_expr( 'event_timestamp', '1 day', $site_tz );
			$fill  = API\build_time_bucket_expr( 'toDateTime(123)', '1 day', $site_tz );
			// Strip the column argument so only the bucketing strategy remains.
			$label_shape = str_replace( 'event_timestamp', 'COL', $label );
			$fill_shape  = str_replace( 'toDateTime(123)', 'COL', $fill );
			$this->assertSame( $label_shape, $fill_shape, "Mismatch for {$site_tz['type']}" );
		}
	}

	public function test_whole_hour_offset_is_whole_hour() {
		$site_tz = [ 'type' => 'offset', 'value' => 36000 ];
		$this->assertTrue( API\site_timezone_is_whole_hour( $site_tz ) );
	}

	public function test_quarter_hour_offset_is_not_whole_hour() {
		$site_tz = [ 'type' => 'offset', 'value' => 20700 ];
		$this->assertFalse( API\site_timezone_is_whole_hour( $site_tz ) );
	}

	public function test_negative_half_hour_offset_is_not_whole_hour() {
		$site_tz = [ 'type' => 'offset', 'value' => -16200 ];
		$this->assertFalse( API\site_timezone_is_whole_hour( $site_tz ) );
	}

	public function test_utc_name_is_whole_hour() {
		$site_tz = [ 'type' => 'name', 'value' => 'UTC' ];
		$this->assertTrue( API\site_timezone_is_whole_hour( $site_tz ) );
	}

	public function test_named_zone_with_whole_hour_offset_is_whole_hour() {
		$site_tz = [ 'type' => 'name', 'value' => 'Australia/Sydney' ];
		$this->assertTrue( API\site_timezone_is_whole_hour( $site_tz ) );
	}

	public function test_named_zone_with_sub_hour_offset_is_not_whole_hour() {
		$site_tz = [ 'type' => 'name', 'value' => 'Asia/Kolkata' ];
		$this->assertFalse( API\site_timezone_is_whole_hour( $site_tz ) );
	}
}
