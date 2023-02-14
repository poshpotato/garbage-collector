import { AcquireItem, Task } from "grimoire-kolmafia";
import {
  buy,
  cliExecute,
  getCampground,
  getClanLounge,
  Item,
  itemPockets,
  meatPockets,
  pickedPockets,
  pocketItems,
  pocketMeat,
  runChoice,
  scrapPockets,
  toItem,
  use,
  useSkill,
  visitUrl,
} from "kolmafia";
import {
  $coinmaster,
  $item,
  $items,
  $skill,
  $skills,
  ChateauMantegna,
  get,
  have,
  SourceTerminal,
  sum,
} from "libram";
import { doingExtrovermectin } from "../extrovermectin";
import { coinmasterPrice, maxBy } from "../lib";
import { garboAverageValue, garboValue } from "../session";

const SummonTomes = $skills`Summon Snowcones, Summon Stickers, Summon Sugar Sheets, Summon Rad Libs, Summon Smithsness`;
const Wads = $items`twinkly wad, cold wad, stench wad, hot wad, sleaze wad, spooky wad`;

function drawBestCards(): void {
  const cardsLeft = Math.floor(3 - get("_deckCardsDrawn") / 5);
  const cardsSeen = get("_deckCardsSeen").toLowerCase();
  const bestCards = [
    { card: "Island", item: $item`blue mana` },
    { card: "Ancestral Recall", item: $item`blue mana` },
    { card: "Plains", item: $item`white mana` },
    { card: "Healing Salve", item: $item`white mana` },
    { card: "Swamp", item: $item`black mana` },
    { card: "Dark Ritual", item: $item`black mana` },
    { card: "Mountain", item: $item`red mana` },
    { card: "Lightning bolt", item: $item`red mana` },
    { card: "Forest", item: $item`green mana` },
    { card: "Giant Growth", item: $item`green mana` },
    { card: "Gift Card", item: $item`gift card` },
    { card: "Mickey", item: $item`1952 Mickey Mantle card` },
  ]
    .filter(({ card }) => !cardsSeen.includes(card.toLowerCase()))
    .sort((a, b) => garboValue(b.item) - garboValue(a.item))
    .splice(0, cardsLeft)
    .map(({ card }) => card);
  for (const card of bestCards) {
    cliExecute(`cheat ${card}`);
  }
}

function bestExtrude(): Item {
  return maxBy($items`browser cookie, hacked gibson`, garboValue);
}

function pickCargoPocket(): void {
  const picked = pickedPockets();
  const items = itemPockets();
  const meats = meatPockets();
  const scraps = scrapPockets();

  function pocketValue(pocket: number): number {
    let value = 0;
    if (pocket in picked) {
      return value;
    }
    if (pocket in items) {
      value += sum(
        Object.entries(pocketItems(pocket)),
        ([item, count]) => garboValue(toItem(item), true) * count
      );
    }
    if (pocket in meats) {
      value += sum(Object.values(pocketMeat(pocket)), (x) => parseInt(x));
    }
    if (pocket in scraps) {
      value += 200;
    }
    return value;
  }

  const pockets: [number, number][] = [];
  for (let i = 1; i <= 666; i++) {
    const value = pocketValue(i);
    if (value > 0) {
      pockets.push([i, value]);
    }
  }

  if (pockets.length > 0) {
    cliExecute(`cargo ${Math.trunc(maxBy(pockets, 1)[0])}`);
  }
}

export const DailyItemTasks: Task[] = [
  ...SummonTomes.map(
    (skill) =>
      <Task>{
        name: `{skill}`,
        ready: () => have(skill),
        completed: () => skill.dailylimit === 0,
        do: () => useSkill(skill, skill.dailylimit),
      }
  ),
  ...[
    {
      name: "Summon Clip Art",
      ready: () => have($skill`Summon Clip Art`),
      completed: () => $skill`Summon Clip Art`.dailylimit === 0,
      do: (): void => {
        let best = $item.none;
        for (let itemId = 5224; itemId <= 5283; itemId++) {
          const current = Item.get(`[${itemId}]`);
          if (garboValue(current) > garboValue(best)) {
            best = current;
          }
        }
        if (best !== $item.none) {
          cliExecute(`try; create ${$skill`Summon Clip Art`.dailylimit} ${best}`);
        }
      },
    },
    {
      name: "Chateau Mantegna Desk",
      ready: () => ChateauMantegna.have(),
      completed: () => get("_chateauDeskHarvested"),
      do: () => visitUrl("place.php?whichplace=chateau&action=chateau_desk2", false),
    },
    {
      name: "Kremlin's Greatest Briefcase Collect",
      ready: () => have($item`Kremlin's Greatest Briefcase`),
      completed: () => get("_kgbClicksUsed") > 17 || get("_kgbDispenserUses") >= 3,
      do: () => cliExecute("Briefcase collect"),
    },
    {
      name: "Ice Cold April Shower",
      ready: () => have($item`Clan VIP Lounge key`) && getClanLounge()["Clan shower"] !== undefined,
      completed: () => get("_aprilShower"),
      do: () => cliExecute("try; shower ice"),
    },
    {
      name: "Swimming Pool Item",
      ready: () =>
        have($item`Clan VIP Lounge key`) &&
        getClanLounge()["Olympic-sized Clan crate"] !== undefined,
      completed: () => get("_olympicSwimmingPoolItemFound"),
      do: () => cliExecute("swim item"),
    },
    {
      name: "Cheat Deck of Every Card",
      ready: () => have($item`Deck of Every Card`),
      completed: () => Math.floor(3 - get("_deckCardsDrawn") / 5) === 0,
      do: () => drawBestCards(),
    },
    {
      name: "Source Terminal Extrude",
      ready: () => SourceTerminal.have(),
      completed: () =>
        get("_sourceTerminalExtrudes") === 3 ||
        garboValue(bestExtrude()) < garboValue($item`Source essence`) * 10,
      do: () => SourceTerminal.extrude(bestExtrude()),
      acquire: [{ item: $item`Source essence`, num: 10 }],
      limit: { soft: 3 },
    },
    {
      name: "Internet Meme Shop viral video",
      completed: () =>
        get("_internetViralVideoBought") ||
        garboValue($item`viral video`) <
          garboValue($item`BACON`) * coinmasterPrice($item`viral video`),
      do: () => buy($coinmaster`Internet Meme Shop`, 1, $item`viral video`),
      acquire: [{ item: $item`BACON`, num: coinmasterPrice($item`viral video`) }],
    },
    {
      name: "Internet Meme Shop plus one",
      completed: () =>
        get("_internetPlusOneBought") ||
        garboValue($item`plus one`) < garboValue($item`BACON`) * coinmasterPrice($item`plus one`),
      do: () => buy($coinmaster`Internet Meme Shop`, 1, $item`plus one`),
      acquire: [{ item: $item`BACON`, num: coinmasterPrice($item`plus one`) }],
    },
    {
      name: "Internet Meme Shop gallon of milk",
      completed: () =>
        get("_internetGallonOfMilkBought") ||
        garboValue($item`gallon of milk`) <
          garboValue($item`BACON`) * coinmasterPrice($item`gallon of milk`),
      do: () => buy($coinmaster`Internet Meme Shop`, 1, $item`gallon of milk`),
      acquire: [{ item: $item`BACON`, num: coinmasterPrice($item`gallon of milk`) }],
    },
    {
      name: "Internet Meme Shop print screen button",
      completed: () =>
        get("_internetPrintScreenButtonBought") ||
        garboValue($item`print screen button`) <
          garboValue($item`BACON`) * coinmasterPrice($item`print screen button`),
      do: () => buy($coinmaster`Internet Meme Shop`, 1, $item`print screen button`),
      acquire: [{ item: $item`BACON`, num: coinmasterPrice($item`print screen button`) }],
    },
    {
      name: "Internet Meme Shop daily dungeon malware",
      completed: () =>
        get("_internetDailyDungeonMalwareBought") ||
        garboValue($item`daily dungeon malware`) <
          garboValue($item`BACON`) * coinmasterPrice($item`daily dungeon malware`),
      do: () => buy($coinmaster`Internet Meme Shop`, 1, $item`daily dungeon malware`),
      acquire: [{ item: $item`BACON`, num: coinmasterPrice($item`daily dungeon malware`) }],
    },
    {
      name: "Rainbow Gravitation",
      ready: () => have($skill`Rainbow Gravitation`),
      completed: () =>
        get("prismaticSummons") === 3 || garboValue($item`prismatic wad`) < sum(Wads, garboValue),
      do: () => useSkill($skill`Rainbow Gravitation`, 3 - get("prismaticSummons")),
      acquire: () => Wads.map((x) => <AcquireItem>{ item: x, num: 3 - get("prismaticSummons") }),
    },
    {
      name: "Request Sandwich",
      ready: () => have($skill`Request Sandwich`),
      completed: () => get("_requestSandwichSucceeded"),
      do: () => useSkill($skill`Request Sandwich`),
      limit: { soft: 10 },
    },
    {
      name: "Demand Sandwich",
      ready: () => have($skill`Demand Sandwich`),
      completed: () => get("_demandSandwich") > 0,
      do: () => useSkill($skill`Demand Sandwich`),
    },
    {
      name: "Tea Tree",
      ready: () => getCampground()["potted tea tree"] !== undefined,
      completed: () => get("_pottedTeaTreeUsed"),
      do: (): void => {
        const teas = $items`cuppa Activi tea, cuppa Alacri tea, cuppa Boo tea, cuppa Chari tea, cuppa Craft tea, cuppa Cruel tea, cuppa Dexteri tea, cuppa Feroci tea, cuppa Flamibili tea, cuppa Flexibili tea, cuppa Frost tea, cuppa Gill tea, cuppa Impregnabili tea, cuppa Improprie tea, cuppa Insani tea, cuppa Irritabili tea, cuppa Loyal tea, cuppa Mana tea, cuppa Mediocri tea, cuppa Monstrosi tea, cuppa Morbidi tea, cuppa Nas tea, cuppa Net tea, cuppa Neuroplastici tea, cuppa Obscuri tea, cuppa Physicali tea, cuppa Proprie tea, cuppa Royal tea, cuppa Serendipi tea, cuppa Sobrie tea, cuppa Toast tea, cuppa Twen tea, cuppa Uncertain tea, cuppa Vitali tea, cuppa Voraci tea, cuppa Wit tea, cuppa Yet tea`;
        const bestTea = maxBy(teas, garboValue);
        const shakeVal = 3 * garboAverageValue(...teas);
        const teaAction = shakeVal > garboValue(bestTea) ? "shake" : bestTea.name;
        cliExecute(`teatree ${teaAction}`);
      },
    },
    {
      name: "Check Jick Jar",
      ready: () => have($item`psychoanalytic jar`),
      completed: () => get("_jickJarAvailable") !== "unknown",
      do: () => visitUrl("showplayer.php?who=1"),
    },
    {
      name: "Acquire Jick Jar",
      ready: () => have($item`psychoanalytic jar`) && get("_jickJarAvailable") === "true",
      completed: () => get("_psychoJarFilled"),
      do: () => visitUrl("showplayer.php?who=1&action=jung&whichperson=jick"),
    },
    {
      name: "Cargo Shorts Pocket",
      ready: () => have($item`Cargo Cultist Shorts`),
      completed: () => get("_cargoPocketEmptied"),
      do: () => pickCargoPocket(),
    },
    {
      name: "Time-Spinner Gin",
      ready: () =>
        have($item`Time-Spinner`) &&
        !doingExtrovermectin() &&
        get("timeSpinnerMedals") >= 5 &&
        get("_timeSpinnerMinutesUsed") <= 8,
      completed: () => get("_timeSpinnerReplicatorUsed"),
      do: () => cliExecute("FarFuture drink"),
    },
    {
      name: "FantasyRealm Hat",
      ready: () => get("frAlways") || get("_frToday"),
      completed: () => have($item`FantasyRealm G. E. M.`),
      do: () => {
        visitUrl("place.php?whichplace=realm_fantasy&action=fr_initcenter");
        runChoice(-1);
      },
      choices: { 1280: 1 },
    },
    {
      name: "Lodestone",
      ready: () => have($item`lodestone`) && !get("_lodestoneUsed"),
      completed: () => get("_lodestoneUsed"),
      do: () => use($item`lodestone`),
    },
    {
      name: "Update Garbage Tote",
      ready: () => have($item`January's Garbage Tote`) && !get("_garbageItemChanged"),
      completed: () => get("_garbageItemChanged"),
      do: () => cliExecute("fold broken champagne bottle"),
    },
    {
      name: "Learn About Bugs",
      ready: () => have($item`S.I.T. Course Completion Certificate`),
      completed: () => get("_sitCourseCompleted", true) || have($skill`Insectologist`),
      do: () => use($item`S.I.T. Course Completion Certificate`),
      choices: { [1494]: 2 },
    },
  ],
];
