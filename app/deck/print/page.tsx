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
import { PrintTrigger } from "./PrintTrigger";

/**
 * Print/PDF version. Each slide is a landscape page.
 * Visit /deck/print → browser auto-opens print dialog → save as PDF.
 */
export default function DeckPrintPage() {
  return (
    <>
      <PrintTrigger />
      <div className="deck-print">
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
