import {
  S01Cover,
  S02Problem,
  S03Solution,
  S04Demo,
  S05Team,
  S06Vision,
  S07Market,
  S08Traction,
  S09Ask,
  S10Contact,
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
        <S02Problem />
        <S03Solution />
        <S04Demo />
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
