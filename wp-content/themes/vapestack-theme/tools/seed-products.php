<?php
/**
 * Seeds the Vapestack demo catalogue: attributes, categories, products, variations and images.
 *
 * Run it with:
 *
 *     wpdev wp eval-file wp-content/themes/vapestack-theme/tools/seed-products.php
 *     wpdev wp eval-file wp-content/themes/vapestack-theme/tools/seed-products.php reset
 *
 * This lives in the theme directory because only `wp-content/themes/vapestack-theme`,
 * `wp-content/uploads` and the kit's plugin are bind-mounted into the container, so a script
 * anywhere else is invisible to `wp eval-file`. It is dev tooling, not site behaviour, and the
 * theme never loads it - it only runs when WP-CLI includes it explicitly.
 *
	 * Re-running is safe: products are matched on SKU and left alone unless `reset` is passed, and
	 * generated images are reused rather than duplicated. `reset` has to be a bare word because
	 * WP-CLI's eval-file rejects an argument that looks like an option.
 *
 * @package vapestack-theme
 */

defined( 'ABSPATH' ) || exit;

/*
 * Nothing here may run outside WP-CLI: it writes posts, terms and uploads, and it has no
 * capability or nonce check because it is not reachable over HTTP.
 */
if ( ! defined( 'WP_CLI' ) || ! WP_CLI ) {
	exit( 'This script only runs through WP-CLI: wpdev wp eval-file <path>' );
}

/**
 * Builds the demo catalogue.
 */
final class Vapestack_Seed_Products {

	/**
	 * Accent colours the generated product images are drawn from, as RGB triples.
	 *
	 * @var array<int, array<int, int>>
	 */
	private const PALETTE = array(
		array( 163, 255, 18 ),  // acid lime
		array( 0, 229, 255 ),   // electric cyan
		array( 255, 45, 149 ),  // hot magenta
		array( 255, 138, 0 ),   // burnt orange
		array( 154, 92, 255 ),  // violet
		array( 0, 255, 178 ),   // mint teal
	);

	/**
	 * Product categories, keyed by slug.
	 *
	 * @var array<string, string>
	 */
	private const CATEGORIES = array(
		'disposables' => 'Disposables',
		'e-liquids'   => 'E-Liquids',
		'pod-kits'    => 'Pod Kits',
	);

	/**
	 * Global product attributes, keyed by slug without the `pa_` prefix.
	 *
	 * @var array<string, array{label: string, terms: array<string, string>}>
	 */
	private const ATTRIBUTES = array(
		'flavour'           => array(
			'label' => 'Flavour',
			'terms' => array(
				'blue-razz-ice'   => 'Blue Razz Ice',
				'frost-mint'      => 'Frost Mint',
				'mango-sunset'    => 'Mango Sunset',
				'midnight-berry'  => 'Midnight Berry',
				'coastal-tobacco' => 'Coastal Tobacco',
				'cola-ice'        => 'Cola Ice',
			),
		),
		'nicotine-strength' => array(
			'label' => 'Nicotine Strength',
			'terms' => array(
				'0mg' => '0mg',
				'3mg' => '3mg',
				'6mg' => '6mg',
			),
		),
		'colour'            => array(
			'label' => 'Colour',
			'terms' => array(
				'midnight-black' => 'Midnight Black',
				'neon-lime'      => 'Neon Lime',
				'arctic-white'   => 'Arctic White',
			),
		),
	);

	/**
	 * Runs the seed.
	 *
	 * @param array<int, string> $args Arguments passed after the file name on the WP-CLI command line.
	 * @return void
	 */
	public static function run( array $args ): void {
		if ( ! function_exists( 'wc_get_product_id_by_sku' ) ) {
			WP_CLI::error( 'WooCommerce is not active.' );
		}

		$reset = in_array( 'reset', $args, true ) || in_array( '--reset', $args, true );

		self::configure_store();
		$attributes = self::ensure_attributes();
		$categories = self::ensure_categories();
		$products   = self::catalogue();

		if ( $reset ) {
			self::delete_products( $products );
		}

		$created = 0;
		$skipped = 0;
		$lines   = array();

		foreach ( $products as $product ) {
			if ( 0 !== wc_get_product_id_by_sku( $product['sku'] ) ) {
				++$skipped;
				$lines[] = sprintf( 'skip    %s (%s already exists)', $product['sku'], $product['name'] );
				continue;
			}

			$category_id = $categories[ $product['category'] ];

			$product_id = 'simple' === $product['type']
				? self::create_simple_product( $product, $category_id )
				: self::create_variable_product( $product, $category_id, $attributes );

			if ( 0 === $product_id ) {
				WP_CLI::warning( 'Could not create ' . $product['sku'] );
				continue;
			}

			++$created;
			$variations = isset( $product['variations'] ) ? count( $product['variations'] ) : 0;
			$lines[]    = sprintf(
				'created %s (%s) - post %d, %d variation(s)',
				$product['sku'],
				$product['name'],
				$product_id,
				$variations
			);
		}

		foreach ( $lines as $line ) {
			WP_CLI::log( $line );
		}

		WP_CLI::success( sprintf( '%d created, %d skipped.', $created, $skipped ) );
	}

	/**
	 * Sets the store options the catalogue depends on.
	 *
	 * @return void
	 */
	private static function configure_store(): void {
		update_option( 'woocommerce_currency', 'USD' );
		update_option( 'woocommerce_manage_stock', 'yes' );

		// Keep the setup wizard and task list out of the way of a headless storefront.
		update_option( 'woocommerce_onboarding_profile', array( 'completed' => true, 'skipped' => true ) );
		update_option( 'woocommerce_task_list_hidden', 'yes' );
	}

	/**
	 * Creates any missing global product attributes and their terms.
	 *
	 * @return array<string, string> Attribute slug mapped to its taxonomy name, e.g. `pa_flavour`.
	 */
	private static function ensure_attributes(): array {
		$taxonomies = array();

		foreach ( self::ATTRIBUTES as $slug => $attribute ) {
			$taxonomy = 'pa_' . $slug;

			if ( ! wc_attribute_taxonomy_id_by_name( $slug ) ) {
				$result = wc_create_attribute(
					array(
						'name'         => $attribute['label'],
						'slug'         => $slug,
						'type'         => 'select',
						'order_by'     => 'menu_order',
						'has_archives' => false,
					)
				);

				if ( is_wp_error( $result ) ) {
					WP_CLI::error( 'Could not create attribute ' . $slug . ': ' . $result->get_error_message() );
				}

				WP_CLI::log( 'created attribute ' . $taxonomy );
			}

			// A newly created attribute is not a registered taxonomy until the cache is dropped
			// and the taxonomies are rebuilt, which is what the next two calls force.
			delete_transient( 'wc_attribute_taxonomies' );
			WC_Cache_Helper::invalidate_cache_group( 'woocommerce-attributes' );

			if ( ! taxonomy_exists( $taxonomy ) ) {
				register_taxonomy(
					$taxonomy,
					array( 'product' ),
					array(
						'hierarchical' => false,
						'public'       => false,
						'show_ui'      => false,
						'query_var'    => true,
						'rewrite'      => false,
					)
				);
			}

			foreach ( $attribute['terms'] as $term_slug => $term_label ) {
				if ( ! term_exists( $term_slug, $taxonomy ) ) {
					wp_insert_term( $term_label, $taxonomy, array( 'slug' => $term_slug ) );
				}
			}

			$taxonomies[ $slug ] = $taxonomy;
		}

		return $taxonomies;
	}

	/**
	 * Creates any missing product categories.
	 *
	 * @return array<string, int> Category slug mapped to its term id.
	 */
	private static function ensure_categories(): array {
		$ids = array();

		foreach ( self::CATEGORIES as $slug => $label ) {
			$term = term_exists( $slug, 'product_cat' );

			if ( ! $term ) {
				$term = wp_insert_term( $label, 'product_cat', array( 'slug' => $slug ) );
			}

			if ( is_wp_error( $term ) ) {
				WP_CLI::error( 'Could not create category ' . $slug . ': ' . $term->get_error_message() );
			}

			$ids[ $slug ] = (int) ( is_array( $term ) ? $term['term_id'] : $term );
		}

		return $ids;
	}

	/**
	 * Deletes the seeded products so `--reset` can rebuild them.
	 *
	 * @param array<int, array<string, mixed>> $products Catalogue definitions.
	 * @return void
	 */
	private static function delete_products( array $products ): void {
		foreach ( $products as $product ) {
			$product_id = wc_get_product_id_by_sku( $product['sku'] );

			if ( 0 === $product_id ) {
				continue;
			}

			$existing = wc_get_product( $product_id );

			if ( $existing instanceof WC_Product ) {
				$existing->delete( true );
				WP_CLI::log( 'deleted ' . $product['sku'] );
			}
		}
	}

	/**
	 * Creates a simple product.
	 *
	 * @param array<string, mixed> $spec        Product definition.
	 * @param int                  $category_id Product category term id.
	 * @return int The new product id, or 0 on failure.
	 */
	private static function create_simple_product( array $spec, int $category_id ): int {
		$product = new WC_Product_Simple();

		$product->set_name( $spec['name'] );
		$product->set_sku( $spec['sku'] );
		$product->set_slug( $spec['slug'] );
		$product->set_status( 'publish' );
		$product->set_catalog_visibility( 'visible' );
		$product->set_description( $spec['description'] );
		$product->set_short_description( $spec['short'] );
		$product->set_category_ids( array( $category_id ) );
		$product->set_regular_price( wc_format_decimal( $spec['price'] ) );
		$product->set_manage_stock( true );
		$product->set_stock_quantity( $spec['stock'] );
		$product->set_stock_status( 0 < $spec['stock'] ? 'instock' : 'outofstock' );
		$product->set_image_id( self::ensure_image( $spec['image'], self::option_label( $spec['image'] ) ) );

		$product_id = $product->save();

		if ( $product_id ) {
			wc_delete_product_transients( $product_id );
		}

		return (int) $product_id;
	}

	/**
	 * Creates a variable product with one variation per option combination.
	 *
	 * @param array<string, mixed>  $spec        Product definition.
	 * @param int                   $category_id Product category term id.
	 * @param array<string, string> $attributes  Attribute slug mapped to taxonomy name.
	 * @return int The new product id, or 0 on failure.
	 */
	private static function create_variable_product( array $spec, int $category_id, array $attributes ): int {
		$product = new WC_Product_Variable();
		$product->set_name( $spec['name'] );
		$product->set_sku( $spec['sku'] );
		$product->set_slug( $spec['slug'] );
		$product->set_status( 'publish' );
		$product->set_catalog_visibility( 'visible' );
		$product->set_description( $spec['description'] );
		$product->set_short_description( $spec['short'] );
		$product->set_category_ids( array( $category_id ) );

		$product_attributes = array();

		foreach ( $spec['attributes'] as $position => $attribute_slug ) {
			$taxonomy = $attributes[ $attribute_slug ];
			$options  = array();

			foreach ( self::ATTRIBUTES[ $attribute_slug ]['terms'] as $term_slug => $term_label ) {
				if ( ! in_array( $term_slug, $spec['options'][ $attribute_slug ], true ) ) {
					continue;
				}

				$term = get_term_by( 'slug', $term_slug, $taxonomy );

				if ( $term instanceof WP_Term ) {
					$options[] = (int) $term->term_id;
				}
			}

			$product_attribute = new WC_Product_Attribute();
			$product_attribute->set_id( (int) wc_attribute_taxonomy_id_by_name( $attribute_slug ) );
			$product_attribute->set_name( $taxonomy );
			$product_attribute->set_options( $options );
			$product_attribute->set_position( $position );
			$product_attribute->set_visible( true );
			$product_attribute->set_variation( true );

			$product_attributes[] = $product_attribute;
		}

		$product->set_attributes( $product_attributes );

		// The parent holds no stock of its own; each variation carries its own quantity.
		$product->set_manage_stock( false );
		$product->set_image_id( self::ensure_image( $spec['options'][ $spec['attributes'][0] ][0], self::option_label( $spec['options'][ $spec['attributes'][0] ][0] ) ) );

		$product_id = (int) $product->save();

		if ( 0 === $product_id ) {
			return 0;
		}

		foreach ( $spec['variations'] as $variation_spec ) {
			$variation_attributes = array();

			foreach ( $spec['attributes'] as $index => $attribute_slug ) {
				$variation_attributes[ $attributes[ $attribute_slug ] ] = $variation_spec['options'][ $index ];
			}

			$variation = new WC_Product_Variation();
			$variation->set_parent_id( $product_id );
			$variation->set_status( 'publish' );
			$variation->set_sku( $spec['sku'] . '-' . implode( '-', $variation_spec['options'] ) );
			$variation->set_attributes( $variation_attributes );
			$variation->set_regular_price( wc_format_decimal( $variation_spec['price'] ) );
			$variation->set_manage_stock( true );
			$variation->set_stock_quantity( $variation_spec['stock'] );
			$variation->set_stock_status( 0 < $variation_spec['stock'] ? 'instock' : 'outofstock' );
			$variation->set_image_id( self::ensure_image( $variation_spec['options'][0], self::option_label( $variation_spec['options'][0] ) ) );
			$variation->save();
		}

		// Rebuilds the parent's price range and "in stock" state from its variations.
		WC_Product_Variable::sync( $product_id );
		wc_delete_product_transients( $product_id );

		return $product_id;
	}

	/**
	 * Generates a product image on first use and returns its attachment id afterwards.
	 *
	 * @param string $slug  Option slug the image belongs to, e.g. `frost-mint`.
	 * @param string $label Attachment title and alt text.
	 * @return int Attachment id, or 0 when the image could not be written.
	 */
	private static function ensure_image( string $slug, string $label ): int {
		$uploads  = wp_upload_dir();
		$filename = 'vapestack-' . $slug . '.png';
		$path     = trailingslashit( $uploads['path'] ) . $filename;
		$url      = trailingslashit( $uploads['url'] ) . $filename;

		$existing = attachment_url_to_postid( $url );

		if ( 0 !== $existing ) {
			/*
			 * One image is generated per option, so several products share it and the first of
			 * them to be seeded is not necessarily the one it should describe. Correct the alt
			 * text on sight rather than leaving the media library claiming the wrong product.
			 */
			if ( get_post_meta( $existing, '_wp_attachment_image_alt', true ) !== $label ) {
				update_post_meta( $existing, '_wp_attachment_image_alt', $label );
				wp_update_post(
					array(
						'ID'         => $existing,
						'post_title' => $label,
					)
				);
			}

			return $existing;
		}

		if ( ! self::write_gradient_png( $path, self::accent_colour( $slug ) ) ) {
			WP_CLI::warning( 'Could not write ' . $path . ' (is GD available?)' );
			return 0;
		}

		require_once ABSPATH . 'wp-admin/includes/image.php';

		$attachment_id = wp_insert_attachment(
			array(
				'post_mime_type' => 'image/png',
				'post_title'     => $label,
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
		update_post_meta( $attachment_id, '_wp_attachment_image_alt', $label );

		return (int) $attachment_id;
	}

	/**
	 * Display name for an option slug, so an image's alt text names what it shows.
	 *
	 * @param string $slug Option slug, e.g. `frost-mint`.
	 * @return string Option label, e.g. `Frost Mint`.
	 */
	private static function option_label( string $slug ): string {
		foreach ( self::ATTRIBUTES as $attribute ) {
			if ( isset( $attribute['terms'][ $slug ] ) ) {
				return $attribute['terms'][ $slug ];
			}
		}

		return ucwords( str_replace( '-', ' ', $slug ) );
	}

	/**
	 * Picks a stable accent colour for a slug.
	 *
	 * @param string $slug Option slug.
	 * @return array<int, int> RGB triple.
	 */
	private static function accent_colour( string $slug ): array {
		return self::PALETTE[ crc32( $slug ) % count( self::PALETTE ) ];
	}

	/**
	 * Draws a vertical gradient from near-black to the accent colour.
	 *
	 * Generated rather than downloaded so seeding needs no network and looks the same every run.
	 *
	 * @param string           $path   Absolute path to write.
	 * @param array<int, int>  $accent RGB triple the gradient ends on.
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

	/**
	 * The catalogue itself.
	 *
	 * `options` lists the values each attribute offers, in `attributes` order, and every
	 * variation's `options` array lines up with the same order - so a two-attribute product
	 * reads as flavour then strength, and a one-attribute product as its single value.
	 *
	 * @return array<int, array<string, mixed>> Product definitions.
	 */
	private static function catalogue(): array {
		return array(
			array(
				'type'        => 'variable',
				'sku'         => 'VS-DSP-6000',
				'name'        => 'Neon Rush 6000',
				'slug'        => 'neon-rush-6000',
				'category'    => 'disposables',
				'short'       => '6000 puffs, mesh coil, USB-C rechargeable.',
				'description' => 'A 6000-puff disposable with a mesh coil and a USB-C port, so the last puff tastes like the first. Draw-activated, nothing to press, nothing to refill.',
				'image'       => 'blue-razz-ice',
				'attributes'  => array( 'flavour', 'nicotine-strength' ),
				'options'     => array(
					'flavour'           => array( 'blue-razz-ice', 'frost-mint', 'mango-sunset' ),
					'nicotine-strength' => array( '3mg', '6mg' ),
				),
				'variations'  => array(
					array(
						'options' => array( 'blue-razz-ice', '3mg' ),
						'price'   => 12.99,
						'stock'   => 24,
					),
					array(
						'options' => array( 'blue-razz-ice', '6mg' ),
						'price'   => 14.99,
						'stock'   => 18,
					),
					array(
						'options' => array( 'frost-mint', '3mg' ),
						'price'   => 12.99,
						'stock'   => 30,
					),
					array(
						'options' => array( 'frost-mint', '6mg' ),
						'price'   => 14.99,
						'stock'   => 12,
					),
					array(
						'options' => array( 'mango-sunset', '3mg' ),
						'price'   => 12.99,
						'stock'   => 9,
					),
					array(
						'options' => array( 'mango-sunset', '6mg' ),
						'price'   => 14.99,
						'stock'   => 0,
					),
				),
			),
			array(
				'type'        => 'variable',
				'sku'         => 'VS-DSP-3000',
				'name'        => 'Frost Rush 3000',
				'slug'        => 'frost-rush-3000',
				'category'    => 'disposables',
				'short'       => '3000 puffs, compact body, two menthol-forward flavours.',
				'description' => 'A pocket-sized 3000-puff disposable for people who want a cold finish. Two flavours, both built around menthol.',
				'image'       => 'frost-mint',
				'attributes'  => array( 'flavour', 'nicotine-strength' ),
				'options'     => array(
					'flavour'           => array( 'frost-mint', 'cola-ice' ),
					'nicotine-strength' => array( '3mg', '6mg' ),
				),
				'variations'  => array(
					array(
						'options' => array( 'frost-mint', '3mg' ),
						'price'   => 9.99,
						'stock'   => 40,
					),
					array(
						'options' => array( 'frost-mint', '6mg' ),
						'price'   => 10.99,
						'stock'   => 26,
					),
					array(
						'options' => array( 'cola-ice', '3mg' ),
						'price'   => 9.99,
						'stock'   => 15,
					),
					array(
						'options' => array( 'cola-ice', '6mg' ),
						'price'   => 10.99,
						'stock'   => 21,
					),
				),
			),
			array(
				'type'        => 'variable',
				'sku'         => 'VS-ELQ-BERRY',
				'name'        => 'Midnight Berry E-Liquid',
				'slug'        => 'midnight-berry-e-liquid',
				'category'    => 'e-liquids',
				'short'       => '60ml shortfill, 70/30 VG/PG, available in three strengths.',
				'description' => 'A dark berry blend in a 60ml shortfill bottle. Mixed 70/30 for sub-ohm tanks, and available in 0mg through 6mg so you can pick your own step down.',
				'image'       => 'midnight-berry',
				'attributes'  => array( 'flavour', 'nicotine-strength' ),
				'options'     => array(
					'flavour'           => array( 'midnight-berry', 'blue-razz-ice' ),
					'nicotine-strength' => array( '0mg', '3mg', '6mg' ),
				),
				'variations'  => array(
					array(
						'options' => array( 'midnight-berry', '0mg' ),
						'price'   => 12.99,
						'stock'   => 22,
					),
					array(
						'options' => array( 'midnight-berry', '3mg' ),
						'price'   => 13.99,
						'stock'   => 30,
					),
					array(
						'options' => array( 'midnight-berry', '6mg' ),
						'price'   => 14.99,
						'stock'   => 14,
					),
					array(
						'options' => array( 'blue-razz-ice', '0mg' ),
						'price'   => 12.99,
						'stock'   => 18,
					),
					array(
						'options' => array( 'blue-razz-ice', '3mg' ),
						'price'   => 13.99,
						'stock'   => 25,
					),
					array(
						'options' => array( 'blue-razz-ice', '6mg' ),
						'price'   => 14.99,
						'stock'   => 11,
					),
				),
			),
			array(
				'type'        => 'variable',
				'sku'         => 'VS-ELQ-TOBACCO',
				'name'        => 'Coastal Tobacco E-Liquid',
				'slug'        => 'coastal-tobacco-e-liquid',
				'category'    => 'e-liquids',
				'short'       => '50ml shortfill, a dry tobacco with a salt-air finish.',
				'description' => 'A dry, lightly sweet tobacco blend in a 50ml shortfill. One flavour only, which makes it the simplest thing to buy here.',
				'image'       => 'coastal-tobacco',
				'attributes'  => array( 'flavour' ),
				'options'     => array(
					'flavour' => array( 'coastal-tobacco' ),
				),
				'variations'  => array(
					array(
						'options' => array( 'coastal-tobacco' ),
						'price'   => 13.99,
						'stock'   => 17,
					),
				),
			),
			array(
				'type'        => 'variable',
				'sku'         => 'VS-POD-PULSE',
				'name'        => 'Pulse Pod Kit',
				'slug'        => 'pulse-pod-kit',
				'category'    => 'pod-kits',
				'short'       => '1100mAh, adjustable airflow, USB-C fast charge.',
				'description' => 'A refillable pod kit with adjustable airflow and a 1100mAh cell that charges in half an hour. Takes both of the pod ranges we stock.',
				'image'       => 'midnight-black',
				'attributes'  => array( 'colour' ),
				'options'     => array(
					'colour' => array( 'midnight-black', 'neon-lime', 'arctic-white' ),
				),
				'variations'  => array(
					array(
						'options' => array( 'midnight-black' ),
						'price'   => 34.99,
						'stock'   => 12,
					),
					array(
						'options' => array( 'neon-lime' ),
						'price'   => 34.99,
						'stock'   => 8,
					),
					array(
						'options' => array( 'arctic-white' ),
						'price'   => 34.99,
						'stock'   => 5,
					),
				),
			),
			array(
				'type'        => 'simple',
				'sku'         => 'VS-POD-AERO',
				'name'        => 'Aero Pod Kit',
				'slug'        => 'aero-pod-kit',
				'category'    => 'pod-kits',
				'short'       => '650mAh, draw-activated, the cheap-and-cheerful option.',
				'description' => 'A draw-activated starter kit in a single colour. No buttons, no settings, and small enough to forget about until you need it.',
				'image'       => 'arctic-white',
				'price'       => 24.99,
				'stock'       => 16,
			),
		);
	}
}

Vapestack_Seed_Products::run( $args ?? array() );
