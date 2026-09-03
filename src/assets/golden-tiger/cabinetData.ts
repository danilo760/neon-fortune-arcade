import part01 from "./cabinet-part-01";
import part02 from "./cabinet-part-02";
import part03 from "./cabinet-part-03";
import part04 from "./cabinet-part-04";
import part05 from "./cabinet-part-05";
import part06 from "./cabinet-part-06";
import part07 from "./cabinet-part-07";
import part08 from "./cabinet-part-08";
import part09 from "./cabinet-part-09";
import part10 from "./cabinet-part-10";

const cabinetBase64 = [
  part01,
  part02,
  part03,
  part04,
  part05,
  part06,
  part07,
  part08,
  part09,
  part10,
].join("");

export const goldenTigerCabinet = `data:image/jpeg;base64,${cabinetBase64}`;
