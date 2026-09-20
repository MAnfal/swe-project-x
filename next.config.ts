import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * `/submission` serves the static submission page under `public/submission/`. Next serves
   * files in `public/` verbatim at their own path, so without this rewrite the page is only
   * reachable at `/submission/index.html` — a URL that is awkward to hand to a reviewer.
   * The prototype itself stays at `/`.
   */
  async rewrites() {
    return [{ source: "/submission", destination: "/submission/index.html" }];
  },
};

export default nextConfig;
