/**
 * Slide wrapper. Full-viewport on screen with snap-scroll;
 * print stylesheet collapses snap behavior so each slide
 * becomes its own A4-ish landscape page in the exported PDF.
 */
export function Slide({
  n,
  total = 15,
  bg = "ivory",
  className = "",
  children,
}: {
  n: number;
  total?: number;
  bg?: "ivory" | "ink" | "oat";
  className?: string;
  children: React.ReactNode;
}) {
  const bgClass = {
    ivory: "bg-ivory text-ink",
    ink: "bg-slate-dark text-ivory",
    oat: "bg-oat text-ink",
  }[bg];

  const footerText =
    bg === "ink" ? "text-ivory/40" : "text-ink-faded";

  return (
    <section
      data-slide={n}
      className={`relative min-h-screen w-full snap-start flex flex-col ${bgClass} print:min-h-0 print:h-screen print:break-after-page ${className}`}
    >
      <div className="u-container flex-1 flex flex-col justify-center py-16 lg:py-24">
        {children}
      </div>
      <div className="u-container pb-6 lg:pb-8">
        <div
          className={`flex justify-between font-mono text-[11px] tracking-[0.12em] uppercase ${footerText}`}
        >
          <span>Veronum</span>
          <span>
            {String(n).padStart(2, "0")} / {String(total).padStart(2, "0")}
          </span>
        </div>
      </div>
    </section>
  );
}
