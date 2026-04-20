import { forwardRef, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useUpdateJob, type DbJob } from "@/hooks/useSupabaseData";
import { Button } from "@/components/ui/button";
import { Camera, ImagePlus, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";

const BUCKET = "company-assets";

type Kind = "before" | "after";

interface Props {
  job: DbJob;
}

/**
 * Manages before/after photos for a single job.
 * - Stored in `company-assets` bucket under `jobs/{jobId}/{before|after}/...`
 * - URLs persisted in jobs.before_photos / jobs.after_photos (text[])
 * - "Take photo" uses capture="environment" (rear camera on mobile)
 * - "From library" allows multi-select from gallery / file picker
 */
export function JobPhotosManager({ job }: Props) {
  const updateJob = useUpdateJob();
  const [busyKind, setBusyKind] = useState<Kind | null>(null);

  const before = job.before_photos ?? [];
  const after = job.after_photos ?? [];

  const handleFiles = async (kind: Kind, files: FileList | null) => {
    if (!files || files.length === 0) return;
    setBusyKind(kind);
    try {
      const uploaded: string[] = [];
      for (const file of Array.from(files)) {
        const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
        const path = `jobs/${job.id}/${kind}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from(BUCKET)
          .upload(path, file, { upsert: false, contentType: file.type || "image/jpeg" });
        if (upErr) throw upErr;
        const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(path);
        uploaded.push(urlData.publicUrl);
      }
      const next = kind === "before"
        ? { before_photos: [...before, ...uploaded] }
        : { after_photos: [...after, ...uploaded] };
      await updateJob.mutateAsync({ id: job.id, ...next } as any);
      toast.success(`${uploaded.length} photo(s) ajoutée(s)`);
    } catch (err: any) {
      toast.error(err.message ?? "Erreur lors de l'upload");
    } finally {
      setBusyKind(null);
    }
  };

  const handleRemove = async (kind: Kind, url: string) => {
    try {
      // Try to delete the file from storage (best-effort)
      const marker = `/${BUCKET}/`;
      const idx = url.indexOf(marker);
      if (idx >= 0) {
        const path = url.slice(idx + marker.length).split("?")[0];
        await supabase.storage.from(BUCKET).remove([path]);
      }
      const next = kind === "before"
        ? { before_photos: before.filter((u) => u !== url) }
        : { after_photos: after.filter((u) => u !== url) };
      await updateJob.mutateAsync({ id: job.id, ...next } as any);
      toast.success("Photo supprimée");
    } catch (err: any) {
      toast.error(err.message ?? "Erreur lors de la suppression");
    }
  };

  return (
    <div className="border-t pt-3 space-y-4">
      <PhotoSection
        title="Photos avant"
        kind="before"
        photos={before}
        busy={busyKind === "before"}
        onFiles={handleFiles}
        onRemove={handleRemove}
      />
      <PhotoSection
        title="Photos après"
        kind="after"
        photos={after}
        busy={busyKind === "after"}
        onFiles={handleFiles}
        onRemove={handleRemove}
      />
    </div>
  );
}

interface PhotoSectionProps {
  title: string;
  kind: Kind;
  photos: string[];
  busy: boolean;
  onFiles: (kind: Kind, files: FileList | null) => void;
  onRemove: (kind: Kind, url: string) => void;
}

const PhotoSection = forwardRef<HTMLDivElement, PhotoSectionProps>(function PhotoSection(
  { title, kind, photos, busy, onFiles, onRemove },
  ref,
) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const libraryRef = useRef<HTMLInputElement>(null);

  return (
    <div ref={ref} className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium">{title} ({photos.length})</p>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={() => cameraRef.current?.click()}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
            <span className="ml-1">Caméra</span>
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={() => libraryRef.current?.click()}
          >
            <ImagePlus className="h-4 w-4" />
            <span className="ml-1">Galerie</span>
          </Button>
        </div>
      </div>

      {/* Hidden inputs */}
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          onFiles(kind, e.target.files);
          e.target.value = "";
        }}
      />
      <input
        ref={libraryRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          onFiles(kind, e.target.files);
          e.target.value = "";
        }}
      />

      {photos.length === 0 ? (
        <p className="text-xs text-muted-foreground">Aucune photo.</p>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {photos.map((url) => (
            <div key={url} className="relative group aspect-square rounded-md overflow-hidden border bg-muted">
              <img src={url} alt={title} loading="lazy" className="w-full h-full object-cover" />
              <Button
                type="button"
                variant="destructive"
                size="icon"
                className="absolute top-1 right-1 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => onRemove(kind, url)}
                title="Supprimer"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
});

