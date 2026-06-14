import {
  S01Cover,
  S02Problem,
  S03Solution,
  S04Speed,
  S05How,
  S06Nessie,
  S07Traction,
  S08GTM,
  S09Economics,
  S10Team,
  S11Vision,
  S12Ask,
  S13Contact,
} from "@/components/deck/slides";
import { DeckChrome } from "./DeckChrome";

/**
 * Live, scrollable pitch deck for Veronum — the multi-LLM bridge.
 * 13 slides, dark mode, snap-scroll. Print stylesheet collapses snap
 * behavior so /deck/print renders one slide per landscape PDF page.
 *
 * Order: Cover → Problem → Solution → 3.5× faster → How it works →
 * vs Nessie → Traction → Go-to-market → Unit economics → Team →
 * Vision → Ask → Contact.
 */
export default function DeckPage() {
  return (
    <>
      <DeckChrome />
      <div className="h-screen overflow-y-auto snap-y snap-mandatory print:overflow-visible print:h-auto">
        <S01Cover />
        <S02Problem />
        <S03Solution />
        <S04Speed />
        <S05How />
        <S06Nessie />
        <S07Traction />
        <S08GTM />
        <S09Economics />
        <S10Team />
        <S11Vision />
        <S12Ask />
        <S13Contact />
      </div>
    </>
  );
}
