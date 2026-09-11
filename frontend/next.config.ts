import type { NextConfig } from "next";

/**
 * Turns an origin into an image remote pattern, or null when it cannot be parsed.
 *
 * Product images are served by WordPress, so whichever origin WP_PUBLIC_URL points at -
 * localhost here, a tunnel once deployed - has to be allowed.
 *
 * @param origin Origin such as `http://localhost:8889`.
 */
function imagePattern(origin: string | undefined) {
  if (!origin) {
    return null;
  }

  try {
    const url = new URL(origin);

    return {
      protocol: url.protocol === "https:" ? ("https" as const) : ("http" as const),
      hostname: url.hostname,
      ...(url.port ? { port: url.port } : {}),
      pathname: "/wp-content/uploads/**",
    };
  } catch {
    return null;
  }
}

const origin = process.env.WP_PUBLIC_URL ?? process.env.WP_INTERNAL_URL;

const nextConfig: NextConfig = {
  images: {
    /*
     * WordPress runs on localhost here, and Next refuses to optimise images from private
     * addresses unless this is set. Accepted deliberately: the only hosts allowed below are
     * the WordPress origin this project runs, and every URL sent to the optimiser comes from
     * our own GraphQL query rather than from user input.
     */
    dangerouslyAllowLocalIP: true,
    remotePatterns: [
      imagePattern(origin) ?? {
        protocol: "http",
        hostname: "localhost",
        port: "8889",
        pathname: "/wp-content/uploads/**",
      },
    ],
  },
};

export default nextConfig;
