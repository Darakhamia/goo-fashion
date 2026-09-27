// Paths the site analytics never records. The admin panel is not the site —
// its heavy pages would drag down the public p75s — and API routes and crawler
// files are not page views.
//
// Shared by the tracker and the collecting routes so the two cannot drift
// apart again: the routes used to filter the retired `/admin` prefix while the
// panel lived at `/goo-studio`, so admin vitals reached the dashboard.
export function isUntrackedPath(path: string): boolean {
  return (
    path.startsWith("/goo-studio") ||
    path.startsWith("/api/") ||
    path === "/robots.txt" ||
    path === "/sitemap.xml"
  );
}
