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
} from "@/components/deck/slidesV2";
import { DeckChrome } from "./DeckChrome";

/**
 * V2 pitch deck preview. Same Server-Component shell as the V1 deck
 * at /deck — only the slide content + chrome label differ. Everything
 * lives at /deck-v2 so V1 stays untouched while V2 gets reviewed.
 */
export default function DeckV2Page() {
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
