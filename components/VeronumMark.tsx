type Props = {
  className?: string;
};

/**
 * Veronum mark — cream squircle + brand-orange serif V.
 * Reuses the same SVG geometry as the macOS .icns / dock icon
 * so the brand reads identically across surfaces.
 */
export function VeronumMark({ className = "" }: Props) {
  return (
    <svg
      viewBox="0 0 1024 1024"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <rect width="1024" height="1024" rx="225" fill="#f0eee6" />
      <text
        x="512"
        y="780"
        textAnchor="middle"
        fontFamily="ui-serif, Newsreader, Georgia, 'Times New Roman', serif"
        fontSize="880"
        fontWeight="500"
        fill="#cc785c"
      >
        V
      </text>
    </svg>
  );
}
