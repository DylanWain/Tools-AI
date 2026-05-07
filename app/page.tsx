import { Nav } from "@/components/Nav";
import { Hero } from "@/components/Hero";
import { PlatformsStrip } from "@/components/PlatformsStrip";
import { MultiAgentDemo } from "@/components/demos/MultiAgentDemo";
import { SharedSessionDemo } from "@/components/demos/SharedSessionDemo";
import { UndoRedoDemo } from "@/components/demos/UndoRedoDemo";
import { ImageChatDemo } from "@/components/demos/ImageChatDemo";
import { DemoSection } from "@/components/demos/DemoSection";
import { FeatureSection } from "@/components/FeatureSection";
import { Pricing } from "@/components/Pricing";
import { FAQ } from "@/components/FAQ";
import { Footer } from "@/components/Footer";

export default function Home() {
  return (
    <>
      <Nav />
      <main>
        <Hero />
        <PlatformsStrip />

        <DemoSection
          id="multi-agent"
          eyebrow="Multi-agent dispatch"
          title="Ten agents, one master task — run in parallel."
          description="Open the multi-agent composer, type a goal, fan it out across up to ten specialist agents, each in their own context window. The Task tool spawns them in parallel; Veronum streams progress back into one bubble."
        >
          <MultiAgentDemo />
        </DemoSection>

        <DemoSection
          id="shared-session"
          eyebrow="Real-time multiplayer"
          title="Code with anyone — every turn mirrors instantly."
          description="Share a session with a teammate and you're both inside the same Claude conversation. Prompts mirror live, presence avatars show who's looking at what, and per-session group chat keeps team chatter out of the Claude thread."
          variant="oat"
        >
          <SharedSessionDemo />
        </DemoSection>

        <DemoSection
          id="undo-redo"
          eyebrow="Undo, redo, version history"
          title="Every five seconds, a snapshot. One click to roll back."
          description="Veronum auto-snapshots the bound folder every 5 seconds of quiet. Undo or redo Claude's last edit straight from the header, or open Version History to revert to any earlier snapshot."
        >
          <UndoRedoDemo />
        </DemoSection>

        <DemoSection
          id="image-chat"
          eyebrow="Image chat"
          title="Paste a screenshot. Claude actually sees it."
          description="Drag, drop, or paste an image into the composer — Veronum auto-resizes it to under 2000 px and ships it as a real image content block (not a text marker). Past images in old turns render inline too."
          variant="oat"
        >
          <ImageChatDemo />
        </DemoSection>

        <FeatureSection />
        <Pricing />
        <FAQ />
      </main>
      <Footer />
    </>
  );
}
