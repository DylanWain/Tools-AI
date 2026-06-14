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
