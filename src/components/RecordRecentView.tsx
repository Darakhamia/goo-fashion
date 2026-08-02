"use client";

import { useEffect } from "react";
import { recordView, type ViewKind } from "@/lib/recently-viewed";

/**
 * Records a visit in this browser's history. Renders nothing — it exists so a
 * server-rendered detail page can note the view without becoming a client
 * component itself.
 */
export default function RecordRecentView({ kind, id }: { kind: ViewKind; id: string }) {
  useEffect(() => {
    recordView(kind, id);
  }, [kind, id]);

  return null;
}
