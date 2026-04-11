import { getRequestConfig } from "next-intl/server";
import { headers } from "next/headers";

export default getRequestConfig(async () => {
  const headerList = await headers();
  const acceptLanguage = headerList.get("accept-language") || "en";

  const locale = acceptLanguage.toLowerCase().includes("fr") ? "fr" : "en";

  return {
    locale,
    messages: {
      common: (await import(`@/locales/${locale}/common.json`)).default,
      home: (await import(`@/locales/${locale}/home/page.json`)).default,
      search: (await import(`@/locales/${locale}/search/page.json`)).default,
      account: (await import(`@/locales/${locale}/account/page.json`)).default,
      account_search: (
        await import(`@/locales/${locale}/account/search/page.json`)
      ).default,
      account_domains: (
        await import(`@/locales/${locale}/account/domains/page.json`)
      ).default,
      news: (await import(`@/locales/${locale}/news/page.json`)).default,
    },
  };
});
