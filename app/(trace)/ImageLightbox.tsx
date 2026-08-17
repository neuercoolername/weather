import type { IntersectionImage } from "@/lib/server/data/intersections";

// Fullscreen overlay for a single image; the backdrop (but not the image) closes it.
export default function ImageLightbox({
  image,
  onClose,
}: {
  image: IntersectionImage;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 bg-black/80 z-50 flex flex-col items-center justify-center"
      onClick={onClose}
    >
      <img
        src={image.signedUrl}
        alt=""
        className="max-h-screen max-w-full object-contain"
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
}
