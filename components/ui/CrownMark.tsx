/**
 * Brand mark - the Hierarchy Class crown, reproduced exactly from the
 * reference artwork (viewBox 1400x770): a tall symmetrical center triangle
 * flanked by two slanted side peaks, all three separate pieces with clean
 * gaps between them. Token-colored (adapts to both themes) and scalable.
 *
 * Size is height-driven: pass `height` (px) and width derives from the
 * source 1400:770 aspect ratio (~1.82:1), so the mark never distorts.
 */
export function CrownMark({
  height = 24,
  className = "",
}: {
  height?: number;
  className?: string;
}) {
  const width = Math.round(height * (1400 / 770));

  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 1400 770"
      fill="none"
      className={`shrink-0 ${className}`}
      aria-hidden
    >
      <g fill="var(--text)">
        {/* Left peak */}
        <polygon points="428,293 585,412 515,565 415,300" />
        {/* Center peak */}
        <polygon points="701,205 855,565 545,565" />
        {/* Right peak */}
        <polygon points="978,293 823,412 885,565 985,300" />
      </g>
    </svg>
  );
}
