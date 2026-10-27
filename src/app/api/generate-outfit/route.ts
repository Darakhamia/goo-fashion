import { NextResponse } from "next/server";
import { requirePlan } from "@/lib/server/require-plan";
import { generateOutfitImage, type ImageStyle, type SlotProduct } from "@/lib/server/outfit-image";

export async function POST(req: Request) {
  const gate = await requirePlan("imageGeneration");
  if (!gate.ok) return gate.response;

  const apiToken = process.env.REPLICATE_API_TOKEN?.trim();
  if (!apiToken) {
    return NextResponse.json(
      {
        error:
          "Replicate API token not configured. Add REPLICATE_API_TOKEN to your environment.",
      },
      { status: 501 }
    );
  }

  const body = await req.json().catch(() => null);
  if (!body?.pieces || !Array.isArray(body.pieces) || body.pieces.length < 1) {
    return NextResponse.json({ error: "No pieces provided." }, { status: 400 });
  }

  const pieces = body.pieces as SlotProduct[];
  const style: ImageStyle =
    body.style === "flatlay" ? "flatlay" : body.style === "tryon" ? "tryon" : "mannequin";

  // For try-on: caller supplies the user's photo as a base64 data-URI.
  // It becomes the first reference so the model knows whose body to dress.
  const userPhotoDataUri: string | undefined =
    style === "tryon" && typeof body.userPhotoDataUri === "string" && body.userPhotoDataUri.startsWith("data:")
      ? body.userPhotoDataUri
      : undefined;

  if (style === "tryon" && !userPhotoDataUri) {
    return NextResponse.json({ error: "A photo is required for the try-on style." }, { status: 400 });
  }

  // The picture itself — references, prompt, model, Storage — is made in
  // lib/server/outfit-image, shared with the studio's AI outfit generator.
  const result = await generateOutfitImage({ apiToken, pieces, style, owner: gate.userId, userPhotoDataUri });
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, failedUrls: result.failedUrls, ...(result.debug && { debug: result.debug }) },
      { status: 500 }
    );
  }

  return NextResponse.json({
    imageUrl: result.imageUrl,
    persisted: result.persisted,
    prompt: result.prompt,
    model: "nano-banana-2",
    style,
    referencesUsed: result.referencesUsed,
    referencesFailed: result.referencesFailed,
  });
}
