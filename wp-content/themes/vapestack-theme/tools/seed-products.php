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
	 * Saturation and value every generated product image is drawn at.
	 *
	 * Fixed rather than per-image: the accent's *hue* is what tells one product from another, and
	 * these two numbers are what keep all of them in the same vivid family as the rest of the design.
	 */
	private const ACCENT_SATURATION = 0.85;

	/** @see ACCENT_SATURATION */
	private const ACCENT_VALUE = 1.0;

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

		foreach ( $products as $catalogue_index => $product ) {
			if ( 0 !== wc_get_product_id_by_sku( $product['sku'] ) ) {
				++$skipped;
				$lines[] = sprintf( 'skip    %s (%s already exists)', $product['sku'], $product['name'] );
				continue;
			}

			$category_id = $categories[ $product['category'] ];

			$product_id = 'simple' === $product['type']
				? self::create_simple_product( $product, $category_id, $catalogue_index )
				: self::create_variable_product( $product, $category_id, $attributes, $catalogue_index );

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
	 * @param int                  $catalogue_index Position of the product in the catalogue.
	 * @return int The new product id, or 0 on failure.
	 */
	private static function create_simple_product( array $spec, int $category_id, int $catalogue_index ): int {
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
		$product->set_image_id(
			self::ensure_image(
				self::image_key( $spec['slug'], $spec['image'] ),
				self::image_label( $spec['name'], $spec['image'] ),
				self::image_hue( $catalogue_index, 0, 1 )
			)
		);

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
	 * @param int                   $catalogue_index Position of the product in the catalogue.
	 * @return int The new product id, or 0 on failure.
	 */
	private static function create_variable_product( array $spec, int $category_id, array $attributes, int $catalogue_index ): int {
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

		$first_option = $spec['options'][ $spec['attributes'][0] ][0];
		$option_slugs = $spec['options'][ $spec['attributes'][0] ];

		$product->set_image_id(
			self::ensure_image(
				self::image_key( $spec['slug'], $first_option ),
				self::image_label( $spec['name'], $first_option ),
				self::image_hue( $catalogue_index, 0, count( $option_slugs ) )
			)
		);

		$product_id = (int) $product->save();

		if ( 0 === $product_id ) {
			return 0;
		}

		foreach ( $spec['variations'] as $variation_spec ) {
			$variation_attributes = array();

			/*
			 * `$attribute_index`, not `$index`: that name is the product's position in the catalogue,
			 * and shadowing it here is what made two of Neon Rush's flavours come out the colour of Frost
			 * Rush. The parameter is `$catalogue_index` and this loop keeps its own name for the same
			 * reason.
			 */
			foreach ( $spec['attributes'] as $attribute_index => $attribute_slug ) {
				$variation_attributes[ $attributes[ $attribute_slug ] ] = $variation_spec['options'][ $attribute_index ];
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

			$variation_option = $variation_spec['options'][0];
			$option_position = (int) array_search( $variation_option, $option_slugs, true );

			$variation->set_image_id(
				self::ensure_image(
					self::image_key( $spec['slug'], $variation_option ),
					self::image_label( $spec['name'], $variation_option ),
					self::image_hue( $catalogue_index, $option_position, count( $option_slugs ) )
				)
			);
			$variation->save();
		}

		// Rebuilds the parent's price range and "in stock" state from its variations.
		WC_Product_Variable::sync( $product_id );
		wc_delete_product_transients( $product_id );

		return $product_id;
	}

	/**
	 * The key one generated image belongs to: the product *and* the option.
	 *
	 * Keying on the option alone, as this did first, made one file do for several products: Neon Rush
	 * 6000 and Midnight Berry E-Liquid were both drawn from `vapestack-blue-razz-ice.png`, so two
	 * different products showed the same picture. Every product now owns its own file for each of its
	 * options, and the variants of one product still share theirs, because they are the same device in
	 * the same finish.
	 *
	 * @param string $product_slug Product slug, e.g. `neon-rush-6000`.
	 * @param string $option_slug  Option slug, e.g. `blue-razz-ice`.
	 * @return string Image key, e.g. `neon-rush-6000-blue-razz-ice`.
	 */
	private static function image_key( string $product_slug, string $option_slug ): string {
		return $product_slug . '-' . $option_slug;
	}

	/**
	 * Attachment title and alt text for one generated image.
	 *
	 * Names the product as well as the finish, because the file belongs to one product now and "Blue
	 * Razz Ice" alone would describe two of them.
	 *
	 * @param string $product_name Product name, e.g. `Neon Rush 6000`.
	 * @param string $option_slug  Option slug, e.g. `blue-razz-ice`.
	 * @return string Alt text, e.g. `Neon Rush 6000 - Blue Razz Ice`.
	 */
	private static function image_label( string $product_name, string $option_slug ): string {
		return $product_name . ' - ' . self::option_label( $option_slug );
	}

	/**
	 * Generates a product image on first use and returns its attachment id afterwards.
	 *
	 * @param string $key   Image key the file belongs to, e.g. `neon-rush-6000-blue-razz-ice`.
	 * @param string $label Attachment title and alt text.
	 * @param int    $hue   Hue to draw the accent at, in degrees.
	 * @return int Attachment id, or 0 when the image could not be written.
	 */
	private static function ensure_image( string $key, string $label, int $hue ): int {
		$uploads  = wp_upload_dir();
		$filename = 'vapestack-' . $key . '.png';
		$path     = trailingslashit( $uploads['path'] ) . $filename;
		$url      = trailingslashit( $uploads['url'] ) . $filename;

		$existing = attachment_url_to_postid( $url );

		if ( 0 !== $existing ) {
			/*
			 * A file belongs to one product and one option, so the alt text written on the way in is the
			 * right one. Repair it on sight anyway: it is one comparison, and a media library that
			 * describes the wrong product is worse than one extra query.
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

		if ( ! self::write_gradient_png( $path, self::hsv_to_rgb( $hue, self::ACCENT_SATURATION, self::ACCENT_VALUE ) ) ) {
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
	 * The hue one generated image is drawn at.
	 *
	 * **Positional, not hashed.** Hashing the key into 360 degrees was the first attempt and it
	 * measured badly: with twelve keys the closest pair came out **3 RGB units apart** — two
	 * different products showing what looks like the same picture, which is the thing the per-product
	 * key exists to prevent. Tuning the hash did not fix it either (the best of eleven variants left
	 * a 10° gap, i.e. two of Neon Rush's own flavours sharing a colour).
	 *
	 * So the catalogue's own order does the work: each product takes a 60° band, and its options are
	 * spread inside that band. Six products with at most three options each leaves every one of the
	 * twelve images at least **20°** from every other, which is a difference you can see.
	 *
	 * @param int $product_index Position of the product in the catalogue, from zero.
	 * @param int $option_index  Position of the option within the product, from zero.
	 * @param int $option_count  How many options the product offers on this attribute.
	 * @return int Hue in degrees, 0-359.
	 */
	private static function image_hue( int $product_index, int $option_index, int $option_count ): int {
		$band   = 60;
		$spread = 40;

		$offset = $option_count > 1
			? (int) round( ( $option_index - ( $option_count - 1 ) / 2 ) * ( $spread / ( $option_count - 1 ) ) )
			: 0;

		return ( ( $product_index * $band ) + $offset + 360 ) % 360;
	}

	/**
	 * Converts a hue, saturation and value into an RGB triple.
	 *
	 * @param int   $hue        Hue in degrees, 0-359.
	 * @param float $saturation Saturation, 0-1.
	 * @param float $value      Value, 0-1.
	 * @return array<int, int> RGB triple, each 0-255.
	 */
	private static function hsv_to_rgb( int $hue, float $saturation, float $value ): array {
		$chroma = $value * $saturation;
		$second = $chroma * ( 1 - abs( fmod( $hue / 60, 2 ) - 1 ) );
		$floor  = $value - $chroma;

		switch ( (int) floor( $hue / 60 ) % 6 ) {
			case 0:
				$rgb = array( $chroma, $second, 0 );
				break;
			case 1:
				$rgb = array( $second, $chroma, 0 );
				break;
			case 2:
				$rgb = array( 0, $chroma, $second );
				break;
			case 3:
				$rgb = array( 0, $second, $chroma );
				break;
			case 4:
				$rgb = array( $second, 0, $chroma );
				break;
			default:
				$rgb = array( $chroma, 0, $second );
		}

		return array(
			(int) round( ( $rgb[0] + $floor ) * 255 ),
			(int) round( ( $rgb[1] + $floor ) * 255 ),
			(int) round( ( $rgb[2] + $floor ) * 255 ),
		);
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
