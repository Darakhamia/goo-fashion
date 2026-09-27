import { NextResponse } from "next/server";
import { getAllColorGroups } from "@/lib/data/db";

export async function GET() {
  const groups = await getAllColorGroups();
  return NextResponse.json(groups);
}
