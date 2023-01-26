import { Item } from "kolmafia";
import { BonusEquipMode } from "../lib";
import { bonusAccessories, usingThumbRing } from "./accessories";
import cheeses from "./cheeses";
import cleaver from "./cleaver";
import mayflower from "./mayflower";
import misc from "./misc";
import pantsgiving from "./pantsgiving";
import sweatpants from "./sweatpants";

function bonusGear(mode: BonusEquipMode): [Item, number][] {
  return [bonusAccessories, cheeses, cleaver, mayflower, misc, pantsgiving, sweatpants]
    .map((bonus) => bonus(mode))
    .flat(1);
}

export { bonusGear, usingThumbRing };
