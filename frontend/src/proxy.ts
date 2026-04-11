import { NextResponse, NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  const token = request.cookies.get("octara_token")?.value;

  const protectedPaths = ["/account"];
  const isProtected = protectedPaths.some((path) =>
    request.nextUrl.pathname.startsWith(path),
  );

  if (isProtected) {
    if (!token) {
      return NextResponse.redirect(new URL("/", request.url));
    }

    try {
      const baseUrl = process.env.ACCOUNT_API_BASE_URL || "https://octara.xyz";
      const res = await fetch(`${baseUrl}/api/v1/me`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        const response = NextResponse.redirect(new URL("/", request.url));
        response.cookies.delete("octara_token");
        return response;
      }

      // Specialized check for domain-specific routes
      if (request.nextUrl.pathname.startsWith("/account/domains/")) {
        const parts = request.nextUrl.pathname.split("/");
        const domainInUrl = parts[3]; // /account/domains/[domain]

        if (
          domainInUrl &&
          !["add", "sitemap", "recrawl", "info"].includes(domainInUrl)
        ) {
          const domainsRes = await fetch(`${baseUrl}/api/v1/me/domains`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (domainsRes.ok) {
            const { domains } = await domainsRes.json();
            const verifiedDomains = domains || [];
            const found = verifiedDomains.find(
              (d: any) => d.domain === domainInUrl,
            );

            if (!found || found.status !== "VERIFIED") {
              return NextResponse.redirect(
                new URL("/account/domains", request.url),
              );
            }
          } else {
            return NextResponse.redirect(
              new URL("/account/domains", request.url),
            );
          }
        }
      }
    } catch (error) {
      console.error("Proxy auth check failed:", error);
      return NextResponse.redirect(new URL("/", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/account/:path*"],
};
