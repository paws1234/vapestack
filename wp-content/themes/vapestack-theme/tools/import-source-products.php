<?php
/**
 * Imports the reviewed product fixture into WooCommerce as demo products.
 *
 * `tools/fetch-source-products.mjs` writes `tools/data/source-products.json`: names and factual
 * specifications read from a public WooCommerce Store API, and nothing else. This script turns each
 * entry into a published product. The two are split so the network and the database are never
 * coupled — the fixture is what a person reviews, what makes the import reproducible, and what
 * still works when the source shop changes or disappears.
 *
 * Run it with:
 *
 *     wpdev wp eval-file wp-content/themes/vapestack-theme/tools/import-source-products.php
 *     wpdev wp eval-file wp-content/themes/vapestack-theme/tools/import-source-products.php reset
 *
 * `reset` deletes only the products this script created — the products carrying a source id — and
 * rebuilds them. It never touches the seeded catalogue. It has to be a bare word because WP-CLI's
 * eval-file rejects an argument that looks like an option.
 *
 * Three deliberate choices:
 *
 * - **The copy is ours.** The fixture carries specs, not prose, and the description and short
 *   description below are generated from those specs. The product page credits the source it read
 *   them from.
 * - **The licence question is answered on the page.** The description says the listing is a demo,
 *   that the specs and the photograph came from a public product page, and it links to that page.
 *   The photography is the one part of this import that is somebody else's work.
 * - **The price is generated, and stable.** The source lists no prices at all (every product comes
 *   back at zero and not purchasable), so a demo price is derived from the source id inside a band
 *   the fixture carries. Same id, same price, every run — which is what makes `reset` reproducible
 *   and a screenshot worth taking.
 * - **The photograph is copied, not hot-linked.** `media_sideload_image()` pulls the file into this
 *   site's uploads, so the shop serves its own copy: an external URL would break the deployed demo
 *   the moment the other shop renames a file, and `next.config.ts` only allows this site's own
 *   origin. When the file cannot be fetched the import falls back to a generated gradient rather
 *   than leaving the product without an image.
 *
 * Re-running is safe: products are matched on SKU, and a product already imported is left alone.
 *
 * @package vapestack-theme
 */

defined( 'ABSPATH' ) || exit;

/*
 * Nothing here may run outside WP-CLI: it writes posts, terms and uploads, and it has no capability
 * or nonce check because it is not reachable over HTTP.
 */
if ( ! defined( 'WP_CLI' ) || ! WP_CLI ) {
	exit( 'This script only runs through WP-CLI: wpdev wp eval-file <path>' );
}

/**
 * Imports the source fixture.
 */
final class Vapestack_Import_Source_Products {

	/**
	 * The reviewed fixture, written by `tools/fetch-source-products.mjs`.
	 *
	 * It lives inside the theme because only the theme directory, the uploads directory and the
	 * kit's plugin are mounted into the container — a fixture anywhere else would be invisible
	 * to `wp eval-file`.
	 */
	private const FIXTURE = __DIR__ . '/data/source-products.json';

	/**
	 * Prefix for imported SKUs, so they are obviously not part of the seeded catalogue.
	 *
	 * The source's own SKUs are empty strings, which is why the source id is the identifier here:
	 * SKU, meta and filename are all derived from it, and it is what makes a re-run idempotent.
	 */
	private const SKU_PREFIX = 'VO-';

	/** Product meta holding the source product id. Its presence is what marks a product imported. */
	private const META_SOURCE_ID = '_vapestack_source_id';

	/**
	 * Attachment meta holding the URL a product image was copied from.
	 *
	 * Two jobs: it stops the same file being sideloaded twice, and it is the record of where a
	 * photograph in the media library came from.
	 */
	private const META_SOURCE_IMAGE = '_vapestack_source_image';

	/** Product meta holding the URL the specifications were read from. */
	private const META_SOURCE_URL = '_vapestack_source_url';

	/** Site credited in the generated description. */
	private const SOURCE_HOST = 'vapeobservation.com';

	/** The site the fixture was read from, linked from the generated description. */
	private const SOURCE_ORIGIN = 'https://' . self::SOURCE_HOST;

	/**
	 * Accent colours the generated product images are drawn from, as RGB triples.
	 *
	 * Deliberately not the seeder's palette: a screen of imported products should not be mistaken
	 * for the seeded ones.
	 *
	 * @var array<int, array<int, int>>
	 */
	private const PALETTE = array(
		array( 255, 94, 0 ),    // ember
		array( 255, 209, 102 ), // amber
		array( 90, 214, 255 ),  // sky
		array( 126, 217, 87 ),  // grass
		array( 214, 108, 255 ), // orchid
		array( 255, 111, 145 ), // rose
	);

	/**
	 * Fewest and most units of each imported product the generated stock may hold.
	 */
	private const STOCK_MIN = 12;

	/** @see STOCK_MIN */
	private const STOCK_MAX = 48;

	/**
	 * Runs the import.
	 *
	 * @param array<int, string> $args Arguments passed after the file name on the WP-CLI command line.
	 * @return void
	 */
	public static function run( array $args ): void {
		if ( ! function_exists( 'wc_get_product_id_by_sku' ) ) {
			WP_CLI::error( 'WooCommerce is not active.' );
		}

		$fixture = self::load_fixture();

		if ( array() === $fixture ) {
			WP_CLI::error(
				'The fixture is empty or missing: ' . self::FIXTURE . '. Run tools/fetch-source-products.mjs.'
			);
		}

		if ( in_array( 'reset', $args, true ) || in_array( '--reset', $args, true ) ) {
			self::delete_imported();
		}
		$categories = self::ensure_categories( $fixture );
		$created    = 0;
		$skipped    = 0;

		foreach ( $fixture as $entry ) {
			$source_id = isset( $entry['source_id'] ) ? absint( $entry['source_id'] ) : 0;
			$name      = isset( $entry['name'] ) ? sanitize_text_field( (string) $entry['name'] ) : '';
			$slug      = isset( $entry['category']['slug'] ) ? sanitize_title( (string) $entry['category']['slug'] ) : '';

			if ( 0 === $source_id || '' === $name || ! isset( $categories[ $slug ] ) ) {
				WP_CLI::warning( 'Skipping a malformed fixture entry.' );
				continue;
			}

			$sku = self::SKU_PREFIX . $source_id;

			if ( 0 !== wc_get_product_id_by_sku( $sku ) ) {
				++$skipped;
				WP_CLI::log( sprintf( 'skip    %s (%s already exists)', $sku, $name ) );
				continue;
			}

			$product_id = self::create_product( $entry, $source_id, $name, $categories[ $slug ] );

			if ( 0 === $product_id ) {
				WP_CLI::warning( 'Could not create ' . $sku );
				continue;
			}

			++$created;
			WP_CLI::log(
				sprintf(
					'created %s (%s) - post %d, $%s, %d spec(s)',
					$sku,
					$name,
					$product_id,
					wc_format_decimal( self::price_for( $source_id, self::band( $entry ) ) ),
					count( self::specs( $entry ) )
				)
			);
		}

		WP_CLI::success( sprintf( '%d created, %d skipped.', $created, $skipped ) );
	}

	/**
	 * Reads and validates the fixture.
	 *
	 * @return array<int, array<string, mixed>> Fixture entries, or an empty array when unreadable.
	 */
	private static function load_fixture(): array {
		if ( ! is_readable( self::FIXTURE ) ) {
			return array();
		}

		$decoded = json_decode( (string) file_get_contents( self::FIXTURE ), true );

		return is_array( $decoded ) ? $decoded : array();
	}

	/**
	 * The price band an entry carries, defaulting to a sane one when it is missing or reversed.
	 *
	 * @param array<string, mixed> $entry Fixture entry.
	 * @return array<int, int> Minimum and maximum price in minor units.
	 */
	private static function band( array $entry ): array {
		$band = isset( $entry['price_band'] ) && is_array( $entry['price_band'] ) ? array_values( $entry['price_band'] ) : array();
		$min  = isset( $band[0] ) ? absint( $band[0] ) : 999;
		$max  = isset( $band[1] ) ? absint( $band[1] ) : 3999;

		return $max > $min ? array( $min, $max ) : array( 999, 3999 );
	}

	/**
	 * Derives a product's demo price from its source id.
	 *
	 * Deterministic on purpose: a price that moved between runs would make `reset` produce a
	 * different shop, and would make two screenshots of the same product disagree. The id is hashed
	 * rather than used directly so consecutive ids in one band do not walk up in price together.
	 *
	 * @param int             $source_id Source product id.
	 * @param array<int, int> $band      Minimum and maximum price in minor units.
	 * @return float Price in major units, always ending in `.99`.
	 */
	private static function price_for( int $source_id, array $band ): float {
		$lowest  = intdiv( $band[0], 100 );
		$highest = intdiv( $band[1], 100 );
		$steps   = max( 1, $highest - $lowest + 1 );
		$dollars = $lowest + ( crc32( (string) $source_id ) % $steps );

		// `.99` rather than `- 0.01`: the band's own bounds are 9.99-style prices, so a band of
		// 999-1499 has to be able to reach 9.99 at one end and 14.99 at the other.
		return (float) ( $dollars + 0.99 );
	}

	/**
	 * Derives a product's demo stock from its source id, the same way the price is derived.
	 *
	 * @param int $source_id Source product id.
	 * @return int Unit count.
	 */
	private static function stock_for( int $source_id ): int {
		return self::STOCK_MIN + ( crc32( 'stock-' . $source_id ) % ( self::STOCK_MAX - self::STOCK_MIN + 1 ) );
	}

	/**
	 * The sanitised specification lines of one fixture entry.
	 *
	 * The fixture came off the network, so it is treated as untrusted input even though a person has
	 * read it: everything is stripped here, before it reaches a post, an attribute or a filename.
	 *
	 * @param array<string, mixed> $entry Fixture entry.
	 * @return array<int, array{label: string, value: string}> Specification lines.
	 */
	private static function specs( array $entry ): array {
		$specs = array();

		foreach ( (array) ( $entry['specs'] ?? array() ) as $spec ) {
			$label = isset( $spec['label'] ) ? sanitize_text_field( (string) $spec['label'] ) : '';
			$value = isset( $spec['value'] ) ? sanitize_text_field( (string) $spec['value'] ) : '';

			if ( '' !== $label && '' !== $value ) {
				$specs[] = array(
					'label' => $label,
					'value' => $value,
				);
			}
		}

		return $specs;
	}

	/**
	 * Creates any missing source categories.
	 *
	 * Each source category keeps its own slug and name rather than being folded into the seeded
	 * ranges: the storefront derives its ranges from the products, so these appear in the navigation
	 * and on the shop page by themselves.
	 *
	 * @param array<int, array<string, mixed>> $fixture Fixture entries.
	 * @return array<string, int> Category slug mapped to its term id.
	 */
	private static function ensure_categories( array $fixture ): array {
		$ids = array();

		foreach ( $fixture as $entry ) {
			$slug  = isset( $entry['category']['slug'] ) ? sanitize_title( (string) $entry['category']['slug'] ) : '';
			$label = isset( $entry['category']['name'] ) ? sanitize_text_field( (string) $entry['category']['name'] ) : '';

			if ( '' === $slug || '' === $label || isset( $ids[ $slug ] ) ) {
				continue;
			}

			$term = term_exists( $slug, 'product_cat' );

			if ( ! $term ) {
				$term = wp_insert_term( $label, 'product_cat', array( 'slug' => $slug ) );
			}

			if ( is_wp_error( $term ) ) {
				WP_CLI::warning( 'Could not create category ' . $slug . ': ' . $term->get_error_message() );
				continue;
			}

			$ids[ $slug ] = (int) ( is_array( $term ) ? $term['term_id'] : $term );
		}

		return $ids;
	}

	/**
	 * Deletes the products and the media this script created, and nothing else.
	 *
	 * Both carry `_vapestack_source_id`, so one query per post type is the whole cleanup. The files
	 * go with the attachments: a `reset` that left a copy of every photograph behind would build up
	 * a media library nobody asked for.
	 *
	 * @return void
	 */
	private static function delete_imported(): void {
		$ids = get_posts(
			array(
				'post_type'        => 'product',
				'post_status'      => 'any',
				'numberposts'      => -1,
				'fields'           => 'ids',
				'meta_key'         => self::META_SOURCE_ID, // phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_meta_key -- WP-CLI tooling, one-off.
				'suppress_filters' => false,
			)
		);

		foreach ( $ids as $id ) {
			$product = wc_get_product( $id );

			if ( $product instanceof WC_Product ) {
				$product->delete( true );
				WP_CLI::log( 'deleted post ' . $id );
			}
		}

		$attachments = get_posts(
			array(
				'post_type'        => 'attachment',
				'post_status'      => 'inherit',
				'numberposts'      => -1,
				'fields'           => 'ids',
				'meta_key'         => self::META_SOURCE_ID, // phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_meta_key -- WP-CLI tooling, one-off.
				'suppress_filters' => false,
			)
		);

		foreach ( $attachments as $attachment_id ) {
			wp_delete_attachment( (int) $attachment_id, true );
			WP_CLI::log( 'deleted attachment ' . $attachment_id );
		}
	}

	/**
	 * Creates one imported product.
	 *
	 * Imported products are simple: the source lists them as simple, and a variable product would
	 * need attributes, terms and a variation per combination that the source does not describe.
	 *
	 * No short description is set. The product page renders a "Details" section from that field, and
	 * the only thing this import could put there is the specifications again — which the spec block
	 * below the description already lists exactly once.
	 *
	 * @param array<string, mixed> $entry       Fixture entry.
	 * @param int                  $source_id   Source product id.
	 * @param string               $name        Sanitised product name.
	 * @param int                  $category_id Product category term id.
	 * @return int The new product id, or 0 on failure.
	 */
	private static function create_product( array $entry, int $source_id, string $name, int $category_id ): int {
		$specs      = self::specs( $entry );
		$source_url = isset( $entry['source_url'] ) ? esc_url_raw( (string) $entry['source_url'] ) : self::SOURCE_ORIGIN;
		$slug       = isset( $entry['source_slug'] ) ? sanitize_title( (string) $entry['source_slug'] ) : '';
		$stock      = self::stock_for( $source_id );

		$product = new WC_Product_Simple();
		$product->set_name( $name );
		$product->set_sku( self::SKU_PREFIX . $source_id );
		$product->set_status( 'publish' );
		$product->set_catalog_visibility( 'visible' );
		$product->set_description( self::description_for( $source_url ) );
		$product->set_category_ids( array( $category_id ) );
		$product->set_attributes( self::attributes_for( $specs ) );
		$product->set_regular_price( wc_format_decimal( self::price_for( $source_id, self::band( $entry ) ) ) );
		$product->set_manage_stock( true );
		$product->set_stock_quantity( $stock );
		$product->set_stock_status( 'instock' );
		$product->set_image_id( self::image_for( $entry, $source_id, $name ) );
		$product->update_meta_data( self::META_SOURCE_ID, $source_id );
		$product->update_meta_data( self::META_SOURCE_URL, $source_url );

		if ( '' !== $slug ) {
			$product->set_slug( $slug );
		}

		$product_id = (int) $product->save();

		if ( 0 !== $product_id ) {
			wc_delete_product_transients( $product_id );
		}

		return $product_id;
	}

	/**
	 * Turns the specification lines into product attributes, so the storefront can render them as a
	 * read-only list rather than scraping them back out of the description.
	 *
	 * These are custom (non-taxonomy) attributes: `set_id(0)` with a plain-text name keeps each
	 * product's specs to itself instead of creating a global attribute and a term for every value the
	 * source happens to publish. They are visible but not used for variations, because an imported
	 * product is simple.
	 *
	 * @param array<int, array{label: string, value: string}> $specs Specification lines.
	 * @return array<int, WC_Product_Attribute> Attributes ready for `set_attributes()`.
	 */
	private static function attributes_for( array $specs ): array {
		$attributes = array();

		foreach ( $specs as $position => $spec ) {
			$attribute = new WC_Product_Attribute();
			$attribute->set_id( 0 );
			$attribute->set_name( $spec['label'] );
			$attribute->set_options( array( $spec['value'] ) );
			$attribute->set_position( $position );
			$attribute->set_visible( true );
			$attribute->set_variation( false );

			$attributes[] = $attribute;
		}

		return $attributes;
	}

	/**
	 * Builds the product's description: the demo's own words, and the credit.
	 *
	 * Written here rather than imported: the source's copy is prose the shop has no right to, while
	 * the facts it publishes are stored as attributes and rendered as the specifications list below
	 * the description. Nothing is repeated between the two.
	 *
	 * @param string $source_url Page the specifications were read from.
	 * @return string Sanitised HTML.
	 */
	private static function description_for( string $source_url ): string {
		return '<p>This is a demo listing. The specifications below and the product photograph were read '
			. 'from a public product page, its price and stock are generated for this storefront, and no '
			. 'payment is ever taken.</p>'
			. '<p>Specifications and photograph from <a href="' . esc_url( $source_url ) . '" rel="nofollow noopener" '
			. 'target="_blank">' . esc_html( self::SOURCE_HOST ) . '</a>.</p>';
	}

	/**
	 * The image a product should use: the copied photograph, or generated art when there is none.
	 *
	 * Copies are keyed on the source URL, so re-running the import never duplicates a file, and the
	 * attachment carries the same source-id meta as the product, so `reset` deletes exactly what this
	 * script made.
	 *
	 * @param array<string, mixed> $entry     Fixture entry.
	 * @param int                  $source_id Source product id.
	 * @param string               $name      Product name, used as the attachment title and alt text.
	 * @return int Attachment id, or 0 when nothing could be produced.
	 */
	private static function image_for( array $entry, int $source_id, string $name ): int {
		$url = self::source_image_url( $entry );

		if ( '' === $url ) {
			return self::ensure_generated_image( $source_id, $name );
		}

		$existing = self::attachment_for_source_image( $url );

		if ( 0 !== $existing ) {
			return $existing;
		}

		$attachment_id = self::sideload( $url, $name );

		if ( 0 === $attachment_id ) {
			WP_CLI::warning( 'Could not copy ' . $url . ' - using generated art instead.' );
			return self::ensure_generated_image( $source_id, $name );
		}

		update_post_meta( $attachment_id, self::META_SOURCE_ID, $source_id );
		update_post_meta( $attachment_id, self::META_SOURCE_IMAGE, $url );

		return $attachment_id;
	}

	/**
	 * The fixture's image URL, or an empty string when it is not one this import will fetch.
	 *
	 * The fixture is reviewed, but it is still data that came off the network. A URL that is not
	 * https, not on the source's own host, or not under its uploads directory is never fetched —
	 * which is also what stops a tampered fixture pointing the server at itself.
	 *
	 * @param array<string, mixed> $entry Fixture entry.
	 * @return string Validated URL, or an empty string.
	 */
	private static function source_image_url( array $entry ): string {
		if ( ! isset( $entry['image'] ) || ! is_string( $entry['image'] ) ) {
			return '';
		}

		$url    = esc_url_raw( trim( $entry['image'] ) );
		$host   = wp_parse_url( $url, PHP_URL_HOST );
		$path   = (string) wp_parse_url( $url, PHP_URL_PATH );
		$scheme = wp_parse_url( $url, PHP_URL_SCHEME );

		if ( 'https' !== $scheme || self::SOURCE_HOST !== $host || ! str_starts_with( $path, '/wp-content/uploads/' ) ) {
			return '';
		}

		return $url;
	}

	/**
	 * Finds an attachment already copied from a source URL.
	 *
	 * @param string $url Source image URL.
	 * @return int Attachment id, or 0 when nothing has been copied from it yet.
	 */
	private static function attachment_for_source_image( string $url ): int {
		$found = get_posts(
			array(
				'post_type'        => 'attachment',
				'post_status'      => 'inherit',
				'numberposts'      => 1,
				'fields'           => 'ids',
				'meta_key'         => self::META_SOURCE_IMAGE, // phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_meta_key -- WP-CLI tooling, one-off.
				'meta_value'       => $url, // phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_meta_value -- WP-CLI tooling, one-off.
				'suppress_filters' => false,
			)
		);

		return $found ? (int) $found[0] : 0;
	}

	/**
	 * Copies a remote image into this site's media library.
	 *
	 * @param string $url  Validated source image URL.
	 * @param string $name Product name, used as the attachment description and alt text.
	 * @return int Attachment id, or 0 on failure.
	 */
	private static function sideload( string $url, string $name ): int {
		require_once ABSPATH . 'wp-admin/includes/file.php';
		require_once ABSPATH . 'wp-admin/includes/media.php';
		require_once ABSPATH . 'wp-admin/includes/image.php';

		$attachment_id = media_sideload_image( $url, 0, $name, 'id' );

		if ( is_wp_error( $attachment_id ) ) {
			WP_CLI::warning( $attachment_id->get_error_message() );

			return 0;
		}

		update_post_meta( (int) $attachment_id, '_wp_attachment_image_alt', $name );

		return (int) $attachment_id;
	}

	/**
	 * Generates a product image on first use and returns its attachment id afterwards.
	 *
	 * The fallback for a product the source lists no photograph for, and for one whose photograph
	 * cannot be fetched: an import that runs with the network down should still produce a complete
	 * catalogue rather than a row of empty cards.
	 *
	 * The file is named after the source id, which is also what the storefront's local-image map
	 * keys on: the deployed shop serves its own copy of every catalogue image, because the WordPress
	 * it reads from is only reachable through a tunnel.
	 *
	 * @param int    $source_id Source product id.
	 * @param string $name      Product name, used as the attachment title and alt text.
	 * @return int Attachment id, or 0 when the image could not be written.
	 */
	private static function ensure_generated_image( int $source_id, string $name ): int {
		$uploads  = wp_upload_dir();
		$filename = 'vapestack-src-' . $source_id . '.png';
		$path     = trailingslashit( $uploads['path'] ) . $filename;
		$url      = trailingslashit( $uploads['url'] ) . $filename;

		$existing = attachment_url_to_postid( $url );

		if ( 0 !== $existing ) {
			return $existing;
		}

		if ( ! self::write_gradient_png( $path, self::accent_colour( $source_id ) ) ) {
			WP_CLI::warning( 'Could not write ' . $path . ' (is GD available?)' );
			return 0;
		}

		require_once ABSPATH . 'wp-admin/includes/image.php';

		$attachment_id = wp_insert_attachment(
			array(
				'post_mime_type' => 'image/png',
				'post_title'     => $name,
				'post_status'    => 'inherit',
			),
			$path,
			0,
			true
		);

		if ( is_wp_error( $attachment_id ) || 0 === $attachment_id ) {
			return 0;
		}

		wp_update_attachment_metadata( $attachment_id, wp_generate_attachment_metadata( $attachment_id, $path ) );
		update_post_meta( $attachment_id, '_wp_attachment_image_alt', $name );

		return (int) $attachment_id;
	}

	/**
	 * Picks a stable accent colour for a source id.
	 *
	 * @param int $source_id Source product id.
	 * @return array<int, int> RGB triple.
	 */
	private static function accent_colour( int $source_id ): array {
		return self::PALETTE[ crc32( (string) $source_id ) % count( self::PALETTE ) ];
	}

	/**
	 * Draws a vertical gradient from near-black to the accent colour.
	 *
	 * The same technique the seeder uses, so the two catalogues look like one shop. Generated rather
	 * than downloaded: no third party's photograph is copied, and importing needs no network.
	 *
	 * @param string          $path   Absolute path to write.
	 * @param array<int, int> $accent RGB triple the gradient ends on.
	 * @return bool True when the PNG was written.
	 */
	private static function write_gradient_png( string $path, array $accent ): bool {
		$width  = 1200;
		$height = 1200;
		$top    = array( 9, 10, 14 );

		$image = imagecreatetruecolor( $width, $height );

		if ( false === $image ) {
			return false;
		}

		for ( $y = 0; $y < $height; $y++ ) {
			$ratio  = $y / ( $height - 1 );
			$colour = imagecolorallocate(
				$image,
				(int) round( $top[0] + ( $accent[0] - $top[0] ) * $ratio ),
				(int) round( $top[1] + ( $accent[1] - $top[1] ) * $ratio ),
				(int) round( $top[2] + ( $accent[2] - $top[2] ) * $ratio )
			);
			imageline( $image, 0, $y, $width - 1, $y, $colour );
		}

		$written = imagepng( $image, $path, 6 );
		imagedestroy( $image );

		return $written;
	}
}

Vapestack_Import_Source_Products::run( $args ?? array() );
