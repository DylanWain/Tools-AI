import {
  S01Cover,
  S02Problem,
  S03Solution,
  S04Demo,
  S04bLocalView,
  S05Team,
  S06Vision,
  S07Market,
  S08Traction,
  S09Ask,
  S10Contact,
} from "@/components/deck/slides";
import { DeckChrome } from "./DeckChrome";

/**
 * Live, scrollable pitch deck for Veronum. 10 slides, snap-scroll on
 * the main column. Print stylesheet collapses snap behavior so
 * /deck/print renders one slide per landscape PDF page.
 *
 * Order: Cover → Problem → Solution → Demo → Team → Vision → Market →
 * Traction & Feedback → Ask → Contact.
 */
export default function DeckPage() {
  return (
    <>
      <DeckChrome />
      <div className="h-screen overflow-y-auto snap-y snap-mandatory print:overflow-visible print:h-auto">
        <S01Cover />
        <S02Problem />
        <S03Solution />
        <S04Demo />
        <S04bLocalView />
        <S05Team />
        <S06Vision />
        <S07Market />
        <S08Traction />
        <S09Ask />
        <S10Contact />
      </div>
    </>
  );
}
