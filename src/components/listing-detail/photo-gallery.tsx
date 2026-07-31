"use client";

import { useState } from "react";
import Image from "next/image";
import { ImageOff } from "lucide-react";
import { useTranslations } from "@/i18n/locale-context";

export function PhotoGallery({
  photos,
  title,
}: {
  photos: string[];
  title: string;
}) {
  const { t } = useTranslations();
  const [active, setActive] = useState(0);

  if (photos.length === 0) {
    return (
      <div className="aspect-video rounded-lg bg-muted flex items-center justify-center text-muted-foreground gap-2">
        <ImageOff className="size-5" /> {t("listingDetail.noPhotos")}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="relative aspect-video rounded-lg overflow-hidden bg-muted">
        <Image
          src={photos[active]}
          alt={title}
          fill
          unoptimized
          className="object-cover"
        />
      </div>
      {photos.length > 1 && (
        <div className="flex gap-2 overflow-x-auto">
          {photos.map((p, i) => (
            <button
              key={p}
              onClick={() => setActive(i)}
              className={`relative w-16 h-16 shrink-0 rounded-md overflow-hidden ring-2 ${i === active ? "ring-primary" : "ring-transparent"}`}
            >
              <Image src={p} alt="" fill unoptimized className="object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
