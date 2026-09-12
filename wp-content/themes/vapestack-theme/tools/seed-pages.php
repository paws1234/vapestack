<?php
/**
 * Seeds the five information pages whose copy is edited in the block editor.
 *
 * Run it with:
 *
 *     wpdev wp eval-file wp-content/themes/vapestack-theme/tools/seed-pages.php
 *     wpdev wp eval-file wp-content/themes/vapestack-theme/tools/seed-pages.php reset
 *
 * `/about`, `/contact`, `/privacy`, `/shipping-returns` and `/terms` used to hold their words as JSX
 * in the front end. After `docs/blocks-plan.md` they hold them in WordPress, so they can be edited
 * without a deploy, and the front end reads them back as blocks.
 *
 * The words themselves live beside this file, in `tools/data/pages/<slug>.html`, as the block markup
 * the editor stores - one paragraph, heading or list per block. They are content, not code: a diff of
 * a paragraph should read like a diff of a paragraph. This script is only the part that writes them
 * into WordPress, which is why re-running it is safe: a page is matched by slug and **updated**, so
 * running it twice leaves five pages rather than ten. `reset` deletes them, which leaves the front
 * end rendering its designed offline state until the seed is run again.
 *
 * This lives in the theme directory because only `wp-content/themes/vapestack-theme`,
 * `wp-content/uploads` and the kit's plugin are bind-mounted into the container, so a script anywhere
 * else is invisible to `wp eval-file`. It is dev tooling, not site behaviour, and the theme never
 * loads it - it only runs when WP-CLI includes it explicitly.
 *
 * @package vapestack-theme
 */

defined( 'ABSPATH' ) || exit;

/*
 * Nothing here may run outside WP-CLI: it writes pages, and it has no capability or nonce check
 * because it is not reachable over HTTP.
 */
if ( ! defined( 'WP_CLI' ) || ! WP_CLI ) {
	exit( 'This script only runs through WP-CLI: wpdev wp eval-file <path>' );
}

/**
 * Writes the block-driven information pages.
 */
final class Vapestack_Seed_Pages {

	/**
	 * The pages, keyed by the slug the front end asks for.
	 *
	 * The title is here rather than in the markup because it is not part of `post_content`: it is what
	 * the editor sees in WP-Admin, and the visitor reads the heading the page component renders.
	 *
	 * @var array<string, string>
	 */
	private const PAGES = array(
		'about'            => 'About Vapestack',
		'contact'          => 'Contact',
		'privacy'          => 'Privacy',
		'shipping-returns' => 'Shipping and returns',
		'terms'            => 'Terms and conditions',
	);

	/**
	 * Where the block markup lives, relative to this file.
	 */
	private const DATA_DIR = '/data/pages/';

	/**
	 * Creates or updates every page, or deletes them all when asked to reset.
	 *
	 * @param array<int, string> $args Arguments WP-CLI passed through, e.g. `reset`.
	 */
	public static function run( array $args = array() ): void {
		if ( in_array( 'reset', $args, true ) ) {
			self::reset();

			return;
		}

		$created = 0;
		$updated = 0;

		foreach ( self::PAGES as $slug => $title ) {
			$markup = self::markup( $slug );

			$existing = get_page_by_path( $slug, OBJECT, 'page' );

			if ( $existing instanceof WP_Post ) {
				$result = wp_update_post(
					array(
						'ID'           => $existing->ID,
						'post_title'   => $title,
						'post_content' => wp_slash( $markup ),
						'post_status'  => 'publish',
					),
					true
				);

				$verb = 'updated';
				++$updated;
			} else {
				$result = wp_insert_post(
					array(
						'post_name'    => $slug,
						'post_title'   => $title,
						'post_type'    => 'page',
						'post_status'  => 'publish',
						'post_content' => wp_slash( $markup ),
					),
					true
				);

				$verb = 'created';
				++$created;
			}

			if ( is_wp_error( $result ) ) {
				WP_CLI::error( 'Could not write ' . $slug . ': ' . $result->get_error_message() );
			}

			WP_CLI::log(
				sprintf(
					'%s %s (post %d, %d blocks)',
					$verb,
					$slug,
					(int) $result,
					self::block_count( $markup )
				)
			);
		}

		WP_CLI::success(
			sprintf(
				'%d created, %d updated across %d pages.',
				$created,
				$updated,
				count( self::PAGES )
			)
		);
	}

	/**
	 * The block markup for one page, read from the file beside this script.
	 *
	 * @param string $slug Page slug, which is also the file's name.
	 */
	private static function markup( string $slug ): string {
		$path = __DIR__ . self::DATA_DIR . $slug . '.html';

		if ( ! is_readable( $path ) ) {
			WP_CLI::error( 'Missing block markup: ' . $path );
		}

		$markup = file_get_contents( $path );

		if ( false === $markup || '' === trim( $markup ) ) {
			WP_CLI::error( 'Empty block markup: ' . $path );
		}

		return $markup;
	}

	/**
	 * How many blocks a page's markup holds, for the run's output.
	 *
	 * Counting opening tags is enough: every block WordPress stores has exactly one, and the number is
	 * only here so a run says something more useful than "wrote a file".
	 *
	 * @param string $markup Block markup.
	 */
	private static function block_count( string $markup ): int {
		return (int) preg_match_all( '/<!--\s+wp:[a-z0-9\/-]+/', $markup );
	}

	/**
	 * Deletes the seeded pages, so the next run proves it can create them.
	 */
	private static function reset(): void {
		foreach ( self::PAGES as $slug => $title ) {
			$existing = get_page_by_path( $slug, OBJECT, 'page' );

			if ( ! $existing instanceof WP_Post ) {
				continue;
			}

			wp_delete_post( $existing->ID, true );

			WP_CLI::log( sprintf( 'deleted %s (post %d)', $slug, $existing->ID ) );
		}

		WP_CLI::success( 'Deleted the seeded pages.' );
	}
}

Vapestack_Seed_Pages::run( $args ?? array() );
