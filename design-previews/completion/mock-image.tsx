import * as React from 'react';
export default function Image({
  priority,
  fill,
  unoptimized,
  ...props
}: React.ImgHTMLAttributes<HTMLImageElement> & {
  priority?: boolean;
  fill?: boolean;
  unoptimized?: boolean;
}) {
  void priority;
  void fill;
  void unoptimized;
  return <img {...props} alt={props.alt || ''} />;
}
