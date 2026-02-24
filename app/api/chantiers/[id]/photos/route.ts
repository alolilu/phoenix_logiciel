import { NextResponse } from "next/server";
import { put } from "@vercel/blob"; 
import { prisma } from "@/src/lib/prisma";
import { requireWriteAccess } from "@/src/lib/rbac";

export const runtime = "nodejs";
const UPLOAD_ROUTE_VERSION = "photos-route-v2026-02-24-02";

export async function POST(req: Request, ctx: any) {
  try {
    // authent
    const auth = await requireWriteAccess(req);
    if (!auth.ok) {
      return NextResponse.json(
        { error: auth.error },
        { status: auth.status, headers: { "x-upload-route-version": UPLOAD_ROUTE_VERSION } }
      );
    }

    const { id: jobId } = await ctx.params;

    // parse multipart
    const formData = await req.formData();

    // 1) récupérer toutes les valeurs explicites "files"
    const filesFromFiles = formData.getAll("files") ?? [];

    // 2) fallback sur "file" unique
    const single = formData.get("file");
    // 3) fallback générique : chercher toute valeur qui est instanceof File (au cas où front envoie autre clé)
    const genericFiles: File[] = [];
    for (const [, value] of formData.entries()) {
      if (value instanceof File) genericFiles.push(value);
    }

    // Compose liste finale sans doublons (en pratique peu probable d'avoir doublons)
    const candidates = [
      ...filesFromFiles,
      ...(single ? [single] : []),
      ...genericFiles,
    ];

    const files: File[] = Array.from(new Set(candidates)).filter((x) => x instanceof File) as File[];

    // Debug / réponse si aucun fichier
    if (files.length === 0) {
      return NextResponse.json(
        {
          error: 'Missing file (expected multipart keys: "files" or "file")',
          debug: {
            receivedKeys: Array.from(formData.keys()),
            count_getAll_files: (filesFromFiles || []).length,
            count_generic_detected: genericFiles.length,
            single_is_file: single instanceof File,
            routeVersion: UPLOAD_ROUTE_VERSION,
          },
        },
        { status: 400, headers: { "x-upload-route-version": UPLOAD_ROUTE_VERSION } }
      );
    }

    // Vérifier token Vercel Blob
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      return NextResponse.json(
        { error: "Vercel Blob Token manquant", routeVersion: UPLOAD_ROUTE_VERSION },
        { status: 500, headers: { "x-upload-route-version": UPLOAD_ROUTE_VERSION } }
      );
    }

    // Upload chaque fichier sur Blob et créer l'attachement Prisma
    const results = [];
    for (const f of files) {
      // put(name, file, options) — tu utilisais déjà put(fileToUpload.name, fileToUpload, ...)
      const blob = await put(f.name, f, { access: "public" });

      const attachment = await prisma.jobAttachment.create({
        data: {
          jobId,
          kind: "PHOTO",
          fileLabel: f.name,
          fileType: f.type || "image/jpeg",
          fileUrl: blob.url,
          uploadedByUserId: auth.userId,
        },
      });

      results.push(attachment);
    }

    return NextResponse.json(
      { ok: true, uploadedCount: results.length, uploaded: results, routeVersion: UPLOAD_ROUTE_VERSION },
      { status: 200, headers: { "x-upload-route-version": UPLOAD_ROUTE_VERSION } }
    );
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "Server error", routeVersion: UPLOAD_ROUTE_VERSION },
      { status: 500, headers: { "x-upload-route-version": UPLOAD_ROUTE_VERSION } }
    );
  }
}