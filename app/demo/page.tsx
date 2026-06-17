import { VeronumDemo } from "@/components/VeronumDemo";

/**
 * Isolated demo route — renders just the VeronumDemo component
 * full-bleed with no nav, no chrome, no padding. Used as the source
 * page for headless-Chrome video capture (see scripts/record-demo.ts).
 */
export default function DemoPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-ivory-light p-8">
      <div className="w-full max-w-[1280px]">
        <VeronumDemo />
      </div>
    </div>
  );
}
