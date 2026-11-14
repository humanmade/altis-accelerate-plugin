<?php
/**
 * Tests for the Content abilities: accelerate/get-content and accelerate/get-media.
 *
 * Calls execute_get_content() and execute_get_media() directly — does NOT go
 * through the abilities registry or MCP.
 *
 * @package Altis\Accelerate
 */

namespace Altis\Accelerate;

use Altis\Accelerate\Abilities\Content;
use WP_UnitTestCase;

require_once dirname( __DIR__, 2 ) . '/inc/abilities/namespace.php';
require_once dirname( __DIR__, 2 ) . '/inc/abilities/content.php';

class ContentAbilitiesTest extends WP_UnitTestCase {

	/** @var int */
	protected $post_id;

	/** @var int */
	protected $draft_id;

	/** @var int */
	protected $image_att_id;

	/** @var int */
	protected $pdf_att_id;

	/** @var int */
	protected $admin_id;

	/** @var int */
	protected $subscriber_id;

	public function set_up() {
		parent::set_up();

		// Create users.
		$this->admin_id = self::factory()->user->create( [ 'role' => 'administrator' ] );
		$this->subscriber_id = self::factory()->user->create( [ 'role' => 'subscriber' ] );

		// Run as admin by default so capability checks pass.
		wp_set_current_user( $this->admin_id );

		// Published post with block markup.
		$this->post_id = self::factory()->post->create( [
			'post_title'   => 'Content Abilities Test Post',
			'post_name'    => 'content-abilities-test-post',
			'post_content' => '<!-- wp:paragraph --><p>Hello <strong>world</strong></p><!-- /wp:paragraph -->',
			'post_status'  => 'publish',
		] );

		// Draft post.
		$this->draft_id = self::factory()->post->create( [
			'post_title'   => 'Draft Post',
			'post_content' => 'Draft content.',
			'post_status'  => 'draft',
		] );

		// Image attachment with metadata.
		$this->image_att_id = self::factory()->attachment->create( [
			'post_mime_type' => 'image/jpeg',
			'post_title'     => 'Test Image',
		] );
		update_post_meta( $this->image_att_id, '_wp_attachment_image_alt', 'A test image' );
		wp_update_attachment_metadata( $this->image_att_id, [
			'width'  => 800,
			'height' => 600,
			'file'   => 'test-image.jpg',
		] );

		// PDF attachment with no image metadata.
		$this->pdf_att_id = self::factory()->attachment->create( [
			'post_mime_type' => 'application/pdf',
			'post_title'     => 'Test PDF',
		] );
	}

	// =========================================================================
	// execute_get_content
	// =========================================================================

	public function test_get_content_by_id_returns_full_raw_content() {
		$result = Content\execute_get_content( [ 'id' => $this->post_id ] );

		$this->assertNotWPError( $result );
		$this->assertIsArray( $result );

		// All expected keys present.
		$this->assertArrayHasKey( 'id', $result );
		$this->assertArrayHasKey( 'type', $result );
		$this->assertArrayHasKey( 'status', $result );
		$this->assertArrayHasKey( 'slug', $result );
		$this->assertArrayHasKey( 'title', $result );
		$this->assertArrayHasKey( 'content', $result );
		$this->assertArrayHasKey( 'template', $result );

		// Values match what was inserted.
		$this->assertSame( $this->post_id, $result['id'] );
		$this->assertSame( 'post', $result['type'] );
		$this->assertSame( 'publish', $result['status'] );
		$this->assertSame( 'content-abilities-test-post', $result['slug'] );
		$this->assertSame( 'Content Abilities Test Post', $result['title'] );

		// Full raw markup — must not be trimmed or filtered.
		$this->assertSame(
			'<!-- wp:paragraph --><p>Hello <strong>world</strong></p><!-- /wp:paragraph -->',
			$result['content']
		);
	}

	public function test_get_content_by_url_resolves_published_post() {
		$url    = get_permalink( $this->post_id );
		$result = Content\execute_get_content( [ 'url' => $url ] );

		$this->assertNotWPError( $result );
		$this->assertSame( $this->post_id, $result['id'] );
		$this->assertSame( 'Content Abilities Test Post', $result['title'] );
	}

	public function test_get_content_id_wins_when_both_provided() {
		// Pass the draft's URL but the published post's ID — result must be the
		// published post, confirming id takes precedence.
		$draft_url = get_permalink( $this->draft_id );
		$result    = Content\execute_get_content( [
			'id'  => $this->post_id,
			'url' => $draft_url,
		] );

		$this->assertNotWPError( $result );
		$this->assertSame( $this->post_id, $result['id'] );
	}

	public function test_get_content_draft_readable_by_admin() {
		$result = Content\execute_get_content( [ 'id' => $this->draft_id ] );

		$this->assertNotWPError( $result );
		$this->assertSame( $this->draft_id, $result['id'] );
		$this->assertSame( 'draft', $result['status'] );
	}

	public function test_get_content_returns_forbidden_for_subscriber() {
		wp_set_current_user( $this->subscriber_id );

		// A subscriber may read published content but must not reach an
		// unpublished post via the read_post meta-cap guard.
		$result = Content\execute_get_content( [ 'id' => $this->draft_id ] );

		$this->assertWPError( $result );
		$this->assertSame( 'forbidden', $result->get_error_code() );
	}

	public function test_get_content_returns_missing_input_error_when_no_id_or_url() {
		$result = Content\execute_get_content( [] );

		$this->assertWPError( $result );
		$this->assertSame( 'missing_input', $result->get_error_code() );
	}

	public function test_get_content_returns_not_found_for_unknown_id() {
		$result = Content\execute_get_content( [ 'id' => 999999 ] );

		$this->assertWPError( $result );
		$this->assertSame( 'not_found', $result->get_error_code() );
	}

	// =========================================================================
	// execute_get_media
	// =========================================================================

	public function test_get_media_lists_attachments_with_expected_fields() {
		$result = Content\execute_get_media( [] );

		$this->assertNotWPError( $result );
		$this->assertArrayHasKey( 'media', $result );
		$this->assertArrayHasKey( 'total_count', $result );
		$this->assertIsArray( $result['media'] );
		$this->assertGreaterThanOrEqual( 2, $result['total_count'] );

		// Find our image attachment in the results.
		$found = null;
		foreach ( $result['media'] as $item ) {
			if ( $item['id'] === $this->image_att_id ) {
				$found = $item;
				break;
			}
		}

		$this->assertNotNull( $found, 'Image attachment should appear in media list.' );
		$this->assertArrayHasKey( 'id', $found );
		$this->assertArrayHasKey( 'url', $found );
		$this->assertArrayHasKey( 'alt', $found );
		$this->assertArrayHasKey( 'width', $found );
		$this->assertArrayHasKey( 'height', $found );
		$this->assertArrayHasKey( 'mime', $found );

		// Alt text reflects the meta value we set.
		$this->assertSame( 'A test image', $found['alt'] );
		$this->assertSame( 800, $found['width'] );
		$this->assertSame( 600, $found['height'] );
		$this->assertSame( 'image/jpeg', $found['mime'] );
	}

	public function test_get_media_non_image_attachment_has_null_dimensions() {
		$result = Content\execute_get_media( [ 'mime_type' => 'application/pdf' ] );

		$this->assertNotWPError( $result );
		$this->assertGreaterThanOrEqual( 1, count( $result['media'] ) );

		$pdf = null;
		foreach ( $result['media'] as $item ) {
			if ( $item['id'] === $this->pdf_att_id ) {
				$pdf = $item;
				break;
			}
		}

		$this->assertNotNull( $pdf, 'PDF attachment should appear when filtering by application/pdf.' );
		$this->assertNull( $pdf['width'] );
		$this->assertNull( $pdf['height'] );
		$this->assertSame( 'application/pdf', $pdf['mime'] );
	}

	public function test_get_media_limit_and_offset_paging() {
		// Create additional attachments so we have at least 3 total.
		$extra1 = self::factory()->attachment->create( [ 'post_mime_type' => 'image/png' ] );
		$extra2 = self::factory()->attachment->create( [ 'post_mime_type' => 'image/png' ] );
		$extra3 = self::factory()->attachment->create( [ 'post_mime_type' => 'image/png' ] );

		$first_page  = Content\execute_get_media( [ 'limit' => 2, 'offset' => 0 ] );
		$second_page = Content\execute_get_media( [ 'limit' => 2, 'offset' => 2 ] );

		$this->assertNotWPError( $first_page );
		$this->assertNotWPError( $second_page );

		// Each page has at most 2 items.
		$this->assertLessThanOrEqual( 2, count( $first_page['media'] ) );
		$this->assertLessThanOrEqual( 2, count( $second_page['media'] ) );

		// Pages do not overlap.
		$first_ids  = array_column( $first_page['media'], 'id' );
		$second_ids = array_column( $second_page['media'], 'id' );
		$this->assertEmpty( array_intersect( $first_ids, $second_ids ), 'Pages must not overlap.' );

		// total_count is consistent across pages.
		$this->assertSame( $first_page['total_count'], $second_page['total_count'] );
	}

	public function test_get_media_mime_type_filter_narrows_to_matching_attachments() {
		$result = Content\execute_get_media( [ 'mime_type' => 'image/jpeg' ] );

		$this->assertNotWPError( $result );

		foreach ( $result['media'] as $item ) {
			$this->assertSame( 'image/jpeg', $item['mime'], 'Only image/jpeg attachments should be returned.' );
		}

		// Our known image attachment is present.
		$ids = array_column( $result['media'], 'id' );
		$this->assertContains( $this->image_att_id, $ids );

		// The PDF must not appear.
		$this->assertNotContains( $this->pdf_att_id, $ids );
	}

	// =========================================================================
	// Additional coverage: not_found by url, forbidden 403 status, template,
	// and search filter.
	// =========================================================================

	public function test_get_content_returns_not_found_for_unknown_url() {
		$result = Content\execute_get_content( [ 'url' => 'https://example.com/no-such-page-xyz/' ] );

		$this->assertWPError( $result );
		$this->assertSame( 'not_found', $result->get_error_code() );
	}

	public function test_get_content_forbidden_error_has_403_status() {
		wp_set_current_user( $this->subscriber_id );

		$result = Content\execute_get_content( [ 'id' => $this->draft_id ] );

		$this->assertWPError( $result );
		$this->assertSame( 'forbidden', $result->get_error_code() );
		$this->assertSame( 403, $result->get_error_data()['status'] );
	}

	public function test_get_content_template_value() {
		$page_id = self::factory()->post->create( [
			'post_type'   => 'page',
			'post_status' => 'publish',
		] );
		update_post_meta( $page_id, '_wp_page_template', 'template-custom.php' );

		$result = Content\execute_get_content( [ 'id' => $page_id ] );

		$this->assertNotWPError( $result );
		$this->assertSame( 'template-custom.php', $result['template'] );
	}

	public function test_get_media_search_filter_narrows_results() {
		// Search matching only the PDF fixture.
		$pdf_result = Content\execute_get_media( [ 'search' => 'Test PDF' ] );

		$this->assertNotWPError( $pdf_result );
		$pdf_ids = array_column( $pdf_result['media'], 'id' );
		$this->assertContains( $this->pdf_att_id, $pdf_ids, 'PDF should appear in "Test PDF" search.' );

		// Search matching only the image fixture.
		$img_result = Content\execute_get_media( [ 'search' => 'Test Image' ] );

		$this->assertNotWPError( $img_result );
		$img_ids = array_column( $img_result['media'], 'id' );
		$this->assertContains( $this->image_att_id, $img_ids, 'Image should appear in "Test Image" search.' );
		$this->assertNotContains( $this->pdf_att_id, $img_ids, 'PDF must not appear in "Test Image" search.' );
	}

	public function test_get_content_published_post_readable_by_subscriber() {
		wp_set_current_user( $this->subscriber_id );

		// Published content is public, so the read_post guard permits a
		// subscriber to read it. The registry-level permission_callback
		// (edit_posts) still gates who can reach the ability in production.
		$result = Content\execute_get_content( [ 'id' => $this->post_id ] );

		$this->assertNotWPError( $result );
		$this->assertSame( $this->post_id, $result['id'] );
	}

	public function test_get_media_scopes_non_privileged_users_to_own_uploads() {
		// Admin-owned attachment on a draft — private to anyone who can't read
		// the parent.
		$admin_private_att = self::factory()->attachment->create( [
			'post_mime_type' => 'image/png',
			'post_parent'    => $this->draft_id,
		] );

		// Admin can read others' private posts, so the whole library is listed.
		$admin_ids = array_column( Content\execute_get_media( [] )['media'], 'id' );
		$this->assertContains( $admin_private_att, $admin_ids, 'Admin sees attachments on a draft.' );
		$this->assertContains( $this->image_att_id, $admin_ids, 'Admin sees others uploads.' );

		// An author (upload_files, no read_private_posts) is scoped to own uploads.
		$author_id = self::factory()->user->create( [ 'role' => 'author' ] );
		wp_set_current_user( $author_id );
		$own_att = self::factory()->attachment->create( [
			'post_mime_type' => 'image/png',
			'post_author'    => $author_id,
		] );

		$author_result = Content\execute_get_media( [] );
		$author_ids    = array_column( $author_result['media'], 'id' );

		$this->assertContains( $own_att, $author_ids, 'Author sees own uploads.' );
		$this->assertNotContains( $admin_private_att, $author_ids, 'Author must not see others private media.' );
		$this->assertNotContains( $this->image_att_id, $author_ids, 'Author is scoped to own uploads.' );

		// total_count reflects only the readable (own) set — no leak, and
		// pagination stays consistent.
		$this->assertSame( count( $author_ids ), $author_result['total_count'] );
	}

	public function test_can_read_content_requires_edit_posts() {
		wp_set_current_user( $this->admin_id );
		$this->assertTrue( Content\can_read_content() );

		wp_set_current_user( $this->subscriber_id );
		$this->assertFalse( Content\can_read_content() );
	}

	public function test_can_read_media_requires_upload_files() {
		wp_set_current_user( $this->admin_id );
		$this->assertTrue( Content\can_read_media() );

		wp_set_current_user( $this->subscriber_id );
		$this->assertFalse( Content\can_read_media() );
	}
}
