import { notFound } from "next/navigation";
import { X } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { getEventAccess } from "../access";
import { AddGalleryImageForm } from "./add-gallery-image-form";
import { MAX_GALLERY_IMAGES } from "@gather/shared/gallery-limits";
import { removeEventGalleryImage } from "./actions";

interface GalleryImageRow {
  id: string;
  storage_path: string;
  caption: string | null;
}

const SIGNED_URL_TTL_SECONDS = 60 * 60; // 1 hour — regenerated on every page load anyway

// A per-event mood board — ideas/references the planner collects while
// planning, not a public-facing gallery like the vendor one. The
// "event-gallery" bucket is private, unlike "vendor-gallery," so display
// always goes through a signed URL generated here per request rather than
// a permanent public one — see the bucket's own migration comment for why.
export default async function EventGalleryPage({ params }: PageProps<"/events/[id]/gallery">) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: event } = await supabase.from("events").select("id, owner_id, name").eq("id", id).maybeSingle();
  if (!event) {
    notFound();
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const access = await getEventAccess(event.id, event.owner_id, user?.id ?? null);
  if (!access.isOwner && !access.isCollaborator) {
    notFound();
  }

  const { data: images } = await supabase
    .from("event_gallery_images")
    .select("id, storage_path, caption")
    .eq("event_id", event.id)
    .order("created_at", { ascending: false })
    .returns<GalleryImageRow[]>();

  const imagesWithUrls = await Promise.all(
    (images ?? []).map(async (image) => {
      const { data } = await supabase.storage.from("event-gallery").createSignedUrl(image.storage_path, SIGNED_URL_TTL_SECONDS);
      return { ...image, url: data?.signedUrl ?? null };
    }),
  );

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col gap-6 px-6 py-10">
      <PageHeader title="Gallery">
        <p className="text-sm font-semibold text-text-muted">{event.name}</p>
      </PageHeader>

      {imagesWithUrls.length > 0 ? (
        <div className="grid grid-cols-2 gap-2">
          {imagesWithUrls.map(
            (image) =>
              image.url && (
                <div key={image.id} className="relative overflow-hidden rounded-[18px] bg-surface">
                  {/* eslint-disable-next-line @next/next/no-img-element --
                      a signed Storage URL isn't a static/optimizable asset
                      next/image can source-check at build time. */}
                  <img src={image.url} alt={image.caption ?? ""} className="aspect-square w-full object-cover" />
                  {access.isEditor && (
                    <form action={removeEventGalleryImage} className="absolute right-1.5 top-1.5">
                      <input type="hidden" name="imageId" value={image.id} />
                      <input type="hidden" name="eventId" value={event.id} />
                      <input type="hidden" name="storagePath" value={image.storage_path} />
                      <button
                        type="submit"
                        aria-label="Remove photo"
                        className="flex h-6 w-6 items-center justify-center rounded-full bg-ink/60 text-white"
                      >
                        <X size={14} strokeWidth={3} />
                      </button>
                    </form>
                  )}
                  {image.caption && (
                    <p className="absolute inset-x-0 bottom-0 truncate bg-ink/60 px-2 py-1 text-[10px] font-semibold text-white">
                      {image.caption}
                    </p>
                  )}
                </div>
              ),
          )}
        </div>
      ) : (
        <Card>
          <p className="text-sm font-semibold text-text-muted">No photos yet — add some ideas or references below.</p>
        </Card>
      )}

      {access.isEditor &&
        (imagesWithUrls.length >= MAX_GALLERY_IMAGES ? (
          <Card>
            <p className="text-sm font-semibold text-text-muted">
              This gallery is at its {MAX_GALLERY_IMAGES}-photo limit. Remove a photo to add a new one.
            </p>
          </Card>
        ) : (
          <AddGalleryImageForm eventId={event.id} />
        ))}
    </main>
  );
}
