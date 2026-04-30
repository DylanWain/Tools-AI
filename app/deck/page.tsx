import {
  S01Cover,
  S02Bet,
  S03Problem,
  S04Solution,
  S05Demo,
  S06WhyNow,
  S07Voice,
  S08Traction,
  S09Model,
  S10Vision,
  S11Market,
  S12Competition,
  S13Team,
  S14Funds,
  S15Ask,
} from "@/components/deck/slides";
import { DeckChrome } from "./DeckChrome";

/**
 * Live, scrollable pitch deck. Snap-scroll on the main column.
 * Print stylesheet (in globals.css) collapses snap behavior so
 * /deck.pdf renders one slide per landscape page.
 */
export default function DeckPage() {
  return (
    <>
      <DeckChrome />
      <div className="h-screen overflow-y-auto snap-y snap-mandatory print:overflow-visible print:h-auto">
        <S01Cover />
        <S02Bet />
        <S03Problem />
        <S04Solution />
        <S05Demo />
        <S06WhyNow />
        <S07Voice />
        <S08Traction />
        <S09Model />
        <S10Vision />
        <S11Market />
        <S12Competition />
        <S13Team />
        <S14Funds />
        <S15Ask />
      </div>
    </>
  );
}
