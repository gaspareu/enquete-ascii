import { describe, test, expect } from "vitest";
import {
  EmotionLaurent,
  EMOTION_LAURENT_PAR_DEFAUT,
  emotionDepuisReplique,
  imagePourEmotionLaurent,
} from "../public/emotion.js";

const portraits = {
  [EmotionLaurent.NEUTRE]: "/images/laurent-neutre.png",
  [EmotionLaurent.MEFIANT]: "/images/laurent-mefiant.png",
  [EmotionLaurent.IRRITE]: "/images/laurent-irrite.png",
  [EmotionLaurent.INQUIET]: "/images/laurent-inquiet.png",
};

describe("EmotionLaurent", () => {
  test("définit les quatre états visuels de Laurent", () => {
    expect(Object.values(EmotionLaurent)).toEqual(["neutre", "mefiant", "irrite", "inquiet"]);
    expect(EMOTION_LAURENT_PAR_DEFAUT).toBe(EmotionLaurent.NEUTRE);
  });

  test.each([
    ["Cette accusation est injuste.", EmotionLaurent.IRRITE],
    ["La mort d'Hélène me bouleverse.", EmotionLaurent.INQUIET],
    ["Je n'ai rien à dire.", EmotionLaurent.MEFIANT],
    ["Que voulez-vous savoir ?", EmotionLaurent.NEUTRE],
  ])("déduit %s comme %s", (replique, emotion) => {
    expect(emotionDepuisReplique(replique)).toBe(emotion);
  });

  test("associe chaque émotion à son image, avec repli neutre", () => {
    for (const emotion of Object.values(EmotionLaurent)) {
      expect(imagePourEmotionLaurent(portraits, emotion)).toBe(portraits[emotion]);
    }
    expect(imagePourEmotionLaurent({ [EmotionLaurent.NEUTRE]: portraits.neutre }, EmotionLaurent.IRRITE)).toBe(
      portraits.neutre,
    );
  });
});
