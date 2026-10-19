import type { ImgHTMLAttributes } from 'react';

// Spark serves the original brand assets directly; no image-processing server is needed.
export default function Image({
  priority,
  loading,
  alt,
  ...props
}: ImgHTMLAttributes<HTMLImageElement> & { priority?: boolean; alt: string }) {
  return (
    <img
      {...props}
      alt={alt}
      loading={priority ? 'eager' : loading || 'lazy'}
      fetchPriority={priority ? 'high' : props.fetchPriority}
    />
  );
}
