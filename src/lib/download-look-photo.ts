/**
 * Save a look's photo to the device.
 *
 * A plain `<a download>` does not save a cross-origin file — the attribute is
 * ignored and the browser navigates to the picture instead. Look photos are
 * always on the storage host, so that never worked for any of them. The bytes
 * come back through our own origin (`/api/looks/image`) and are saved from a
 * blob, the way the studio's card export does it.
 *
 * Used by My looks and the Builder's Save look. Resolves to the reason it
 * failed, or null once the file is saved.
 */
export async function downloadLookPhoto(url: string): Promise<string | null> {
  try {
    const res = await fetch(`/api/looks/image?url=${encodeURIComponent(url)}`);
    if (!res.ok) {
      const message = await res.json().then((j: { error?: string }) => j.error).catch(() => null);
      return message ?? "Could not download the photo.";
    }
    const blob = await res.blob();
    const href = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = href;
    link.download = /filename="([^"]+)"/.exec(res.headers.get("Content-Disposition") ?? "")?.[1] ?? "goo-look.jpg";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(href);
    return null;
  } catch {
    return "Could not download the photo.";
  }
}
