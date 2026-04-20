"use client";

// Public surface for domain-event tracking. Use in product pages, outfit
// pages, builder, etc. Non-blocking.
//
// Usage: track("product_view", { targetId: product.id })

import { beacon, getSessionId } from "./session";

export type AnalyticsEventName =
  | "product_view"
  | "outfit_view"
  | "like_product"
  | "unlike_product"
  | "like_outfit"
  | "unlike_outfit"
  | "save_outfit"
  | "generate_start"
  | "generate_success"
  | "generate_error"
  | "sign_up"
  | "sign_in"
  | "subscribe_click"
  | "plan_upgrade"
  | "stylist_open"
  | "builder_open"
  | "search";

export function track(event: AnalyticsEventName, props: { targetId?: string; [k: string]: unknown } = {}) {
  if (typeof window === "undefined") return;
  const payload = {
    event,
    session_id: getSessionId(),
    path: window.location.pathname,
    target_id: props.targetId ?? null,
    props: Object.keys(props).length ? props : null,
  };
  beacon("/api/analytics/event", payload);
}
