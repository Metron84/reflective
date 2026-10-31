import { Archivo } from "next/font/google";

/** Variable Archivo so the headlines can use font-stretch. */
export const yourSayDisplay = Archivo({
  subsets: ["latin"],
  display: "swap",
  weight: "variable",
  axes: ["wdth"],
});
