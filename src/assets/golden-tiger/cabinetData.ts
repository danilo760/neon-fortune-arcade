import part01 from "./cabinet-part-01";
import part02 from "./cabinet-part-02";
import part03 from "./cabinet-part-03";
import part041 from "./cabinet-04-1";
import part042 from "./cabinet-04-2";
import part043 from "./cabinet-04-3";
import part044 from "./cabinet-04-4";
import part045 from "./cabinet-04-5";
import part046 from "./cabinet-04-6";
import part047 from "./cabinet-04-7";
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
  part041,
  part042,
  part043,
  part044,
  part045,
  part046,
  part047,
  part05,
  part06,
  part07,
  part08,
  part09,
  part10,
].join("");

export const goldenTigerCabinet = `data:image/jpeg;base64,${cabinetBase64}`;
