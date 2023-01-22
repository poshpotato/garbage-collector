import {
  availableAmount,
  buy,
  canEquip,
  cliExecute,
  getCampground,
  getClanName,
  guildStoreAvailable,
  inebrietyLimit,
  Item,
  logprint,
  maximize,
  myAdventures,
  myBasestat,
  myClass,
  myGardenType,
  myInebriety,
  myLevel,
  myTurncount,
  print,
  putStash,
  retrieveItem,
  runChoice,
  setAutoAttack,
  Stat,
  toInt,
  use,
  visitUrl,
  xpath,
} from "kolmafia";
import {
  $class,
  $classes,
  $coinmaster,
  $item,
  $items,
  $skill,
  $slots,
  Clan,
  get,
  getFoldGroup,
  have,
  haveInCampground,
  JuneCleaver,
  set,
  setDefaultMaximizeOptions,
  sinceKolmafiaRevision,
} from "libram";
import { nonOrganAdventures, runDiet } from "./diet";
import { dailyFights, freeFights, printEmbezzlerLog } from "./fights";
import {
  bestJuneCleaverOption,
  checkGithubVersion,
  HIGHLIGHT,
  maxBy,
  printLog,
  propertyManager,
  questStep,
  safeRestore,
  userConfirmDialog,
} from "./lib";
import { meatMood, useBuffExtenders } from "./mood";
import postCombatActions from "./post";
import { stashItems, withStash, withVIPClan } from "./clan";
import { dailySetup, postFreeFightDailySetup } from "./dailies";
import { potionSetup } from "./potions";
import { garboAverageValue, printGarboSession, startSession } from "./session";
import { yachtzeeChain } from "./yachtzee";
import barfTurn from "./barfTurn";
import { estimatedTurns } from "./turns";
import { Args } from "grimoire-kolmafia";
import { globalOptions } from "./config";

// Max price for tickets. You should rethink whether Barf is the best place if they're this expensive.
const TICKET_MAX_PRICE = 500000;

function ensureBarfAccess() {
  if (!(get("stenchAirportAlways") || get("_stenchAirportToday"))) {
    const ticket = $item`one-day ticket to Dinseylandfill`;
    // TODO: Get better item acquisition logic that e.g. checks own mall store.
    if (!have(ticket)) buy(1, ticket, TICKET_MAX_PRICE);
    use(ticket);
  }
  if (!get("_dinseyGarbageDisposed")) {
    print("Disposing of garbage.", HIGHLIGHT);
    retrieveItem($item`bag of park garbage`);
    visitUrl("place.php?whichplace=airport_stench&action=airport3_tunnels");
    runChoice(6);
    cliExecute("refresh inv");
  }
}

export function canContinue(): boolean {
  return (
    myAdventures() > globalOptions.saveTurns &&
    (globalOptions.stopTurncount === null || myTurncount() < globalOptions.stopTurncount)
  );
}

export function main(argString = ""): void {
  sinceKolmafiaRevision(27075);
  checkGithubVersion();

  Args.fill(globalOptions, argString);
  if (globalOptions.version) return; // Since we always print the version, all done!
  if (globalOptions.help) {
    Args.showHelp(globalOptions);
    return;
  }

  const completedProperty = "_garboCompleted";
  set(completedProperty, "");

  if (globalOptions.prefs.autoUserConfirm) {
    print(
      "I have set auto-confirm to true and accept all ramifications that come with that.",
      "red"
    );
  }

  if (
    !$classes`Seal Clubber, Turtle Tamer, Pastamancer, Sauceror, Disco Bandit, Accordion Thief, Cow Puncher, Snake Oiler, Beanslinger`.includes(
      myClass()
    )
  ) {
    throw new Error(
      "Garbo does not support non-WOL avatar classes. It barely supports WOL avatar classes"
    );
  }

  if (!get("kingLiberated") || myLevel() < 13 || Stat.all().some((s) => myBasestat(s) < 75)) {
    if (globalOptions.prefs.skipAscensionCheck) {
      logprint("This player is a silly goose, who ignored our warnings about being underleveled.");
    } else {
      const proceedRegardless = userConfirmDialog(
        "Looks like your ascension may not be done, or you may be severely underleveled. Running garbo in an unintended character state can result in serious injury and even death. Are you sure you want to garbologize?",
        true
      );
      if (!proceedRegardless) {
        throw new Error("User interrupt requested. Stopping Garbage Collector.");
      } else {
        logprint(
          "This player is a silly goose, who ignored our warnings about being underleveled."
        );
      }
    }
  }

  if (
    myInebriety() > inebrietyLimit() &&
    (!have($item`Drunkula's wineglass`) || !canEquip($item`Drunkula's wineglass`))
  ) {
    throw new Error(
      "Go home, you're drunk. And don't own (or can't equip) Drunkula's wineglass. Consider either being sober or owning Drunkula's wineglass and being able to equip it."
    );
  }

  if (globalOptions.prefs.valueOfAdventure && globalOptions.prefs.valueOfAdventure <= 3500) {
    throw `Your valueOfAdventure is set to ${globalOptions.prefs.valueOfAdventure}, which is too low for barf farming to be worthwhile. If you forgot to set it, use "set valueOfAdventure = XXXX" to set it to your marginal turn meat value.`;
  }
  if (globalOptions.prefs.valueOfAdventure && globalOptions.prefs.valueOfAdventure >= 10000) {
    throw `Your valueOfAdventure is set to ${globalOptions.prefs.valueOfAdventure}, which is definitely incorrect. Please set it to your reliable marginal turn value.`;
  }

  if (globalOptions.turns) {
    if (globalOptions.turns >= 0) {
      globalOptions.stopTurncount = myTurncount() + globalOptions.turns;
    } else {
      globalOptions.saveTurns = -globalOptions.turns;
    }
  }

  if (stashItems.length > 0) {
    if (
      userConfirmDialog(
        `Garbo has detected that you have the following items still out of the stash from a previous run of garbo: ${stashItems
          .map((item) => item.name)
          .join(",")}. Would you like us to return these to the stash now?`,
        true
      )
    ) {
      const clanIdOrName = globalOptions.prefs.stashClan;
      const parsedClanIdOrName =
        clanIdOrName !== "none"
          ? clanIdOrName.match(/^\d+$/)
            ? parseInt(clanIdOrName)
            : clanIdOrName
          : null;

      if (parsedClanIdOrName) {
        Clan.with(parsedClanIdOrName, () => {
          for (const item of [...stashItems]) {
            if (getFoldGroup(item).some((item) => have(item))) {
              cliExecute(`fold ${item}`);
            }
            const retrieved = retrieveItem(item);
            if (
              item === $item`Spooky Putty sheet` &&
              !retrieved &&
              have($item`Spooky Putty monster`)
            ) {
              continue;
            }
            print(`Returning ${item} to ${getClanName()} stash.`, HIGHLIGHT);
            if (putStash(item, 1)) {
              stashItems.splice(stashItems.indexOf(item), 1);
            }
          }
        });
      } else throw new Error("Error: No garbo_stashClan set.");
    } else {
      stashItems.splice(0, stashItems.length);
    }
  }

  startSession();
  if (!globalOptions.nobarf && !globalOptions.simdiet) {
    ensureBarfAccess();
  }
  if (globalOptions.simdiet) {
    propertyManager.set({
      logPreferenceChange: true,
      autoSatisfyWithMall: true,
      autoSatisfyWithNPCs: true,
      autoSatisfyWithCoinmasters: true,
      autoSatisfyWithStash: false,
      maximizerFoldables: true,
      autoTuxedo: true,
      autoPinkyRing: true,
      autoGarish: true,
      valueOfInventory: 2,
      suppressMallPriceCacheMessages: true,
    });
    runDiet();
    propertyManager.resetAll();
    return;
  }

  const gardens = $items`packet of pumpkin seeds, Peppermint Pip Packet, packet of dragon's teeth, packet of beer seeds, packet of winter seeds, packet of thanksgarden seeds, packet of tall grass seeds, packet of mushroom spores, packet of rock seeds`;
  const startingGarden = gardens.find((garden) =>
    Object.getOwnPropertyNames(getCampground()).includes(garden.name)
  );
  if (
    startingGarden &&
    !$items`packet of tall grass seeds, packet of mushroom spores`.includes(startingGarden) &&
    getCampground()[startingGarden.name] &&
    $items`packet of tall grass seeds, packet of mushroom spores`.some((gardenSeed) =>
      have(gardenSeed)
    )
  ) {
    if (startingGarden === $item`packet of rock seeds`) {
      visitUrl("campground.php?action=rgarden1&pwd");
      visitUrl("campground.php?action=rgarden2&pwd");
      visitUrl("campground.php?action=rgarden3&pwd");
    } else {
      visitUrl("campground.php?action=garden&pwd");
    }
  }

  const aaBossFlag =
    xpath(
      visitUrl("account.php?tab=combat"),
      `//*[@id="opt_flag_aabosses"]/label/input[@type='checkbox']@checked`
    )[0] === "checked"
      ? 1
      : 0;

  try {
    print("Collecting garbage!", HIGHLIGHT);
    if (globalOptions.stopTurncount !== null) {
      print(`Stopping in ${globalOptions.stopTurncount - myTurncount()}`, HIGHLIGHT);
    }
    print();

    if (
      have($item`packet of tall grass seeds`) &&
      myGardenType() !== "grass" &&
      myGardenType() !== "mushroom"
    ) {
      use($item`packet of tall grass seeds`);
    }

    setAutoAttack(0);
    visitUrl(`account.php?actions[]=flag_aabosses&flag_aabosses=1&action=Update`, true);

    const maximizerCombinationLimit = globalOptions.quick
      ? 100000
      : get("maximizerCombinationLimit");

    propertyManager.set({
      logPreferenceChange: true,
      logPreferenceChangeFilter: [
        ...new Set([
          ...get("logPreferenceChangeFilter").split(","),
          "libram_savedMacro",
          "maximizerMRUList",
          "testudinalTeachings",
          "garboEmbezzlerDate",
          "garboEmbezzlerCount",
          "garboEmbezzlerSources",
          "spadingData",
        ]),
      ]
        .sort()
        .filter((a) => a)
        .join(","),
      battleAction: "custom combat script",
      customCombatScript: "garbo",
      autoSatisfyWithMall: true,
      autoSatisfyWithNPCs: true,
      autoSatisfyWithCoinmasters: true,
      autoSatisfyWithStash: false,
      dontStopForCounters: true,
      maximizerFoldables: true,
      hpAutoRecovery: -0.05,
      hpAutoRecoveryTarget: 0.0,
      mpAutoRecovery: -0.05,
      mpAutoRecoveryTarget: 0.0,
      afterAdventureScript: "",
      betweenBattleScript: "",
      choiceAdventureScript: "",
      counterScript: "",
      familiarScript: "",
      currentMood: "apathetic",
      autoTuxedo: true,
      autoPinkyRing: true,
      autoGarish: true,
      allowNonMoodBurning: !globalOptions.ascend,
      allowSummonBurning: true,
      libramSkillsSoftcore: "none", // Don't cast librams when mana burning, handled manually based on sale price
      valueOfInventory: 2,
      suppressMallPriceCacheMessages: true,
      maximizerCombinationLimit: maximizerCombinationLimit,
    });
    let bestHalloweiner = 0;
    if (haveInCampground($item`haunted doghouse`)) {
      const halloweinerOptions: { price: number; choiceId: number }[] = (
        [
          [$items`bowl of eyeballs, bowl of mummy guts, bowl of maggots`, 1],
          [$items`blood and blood, Jack-O-Lantern beer, zombie`, 2],
          [$items`wind-up spider, plastic nightmare troll, Telltale™ rubber heart`, 3],
        ] as [Item[], number][]
      ).map(([halloweinerOption, choiceId]) => {
        return {
          price: garboAverageValue(...halloweinerOption),
          choiceId: choiceId,
        };
      });
      bestHalloweiner = maxBy(halloweinerOptions, "price").choiceId;
    }
    propertyManager.setChoices({
      1106: 3, // Ghost Dog Chow
      1107: 1, // tennis ball
      1108: bestHalloweiner,
      1340: 1, // Accept the doctor quest
      1341: 1, // Cure her poison
    });

    if (JuneCleaver.have()) {
      propertyManager.setChoices(
        Object.fromEntries(
          JuneCleaver.choices.map((choice) => [choice, bestJuneCleaverOption(choice)])
        )
      );
    }

    safeRestore();

    if (questStep("questM23Meatsmith") === -1) {
      visitUrl("shop.php?whichshop=meatsmith&action=talk");
      runChoice(1);
    }
    if (questStep("questM24Doc") === -1) {
      visitUrl("shop.php?whichshop=doc&action=talk");
      runChoice(1);
    }
    if (questStep("questM25Armorer") === -1) {
      visitUrl("shop.php?whichshop=armory&action=talk");
      runChoice(1);
    }

    // unlock the sea
    if (myLevel() >= 11 && questStep("questS01OldGuy") === -1) {
      visitUrl("place.php?whichplace=sea_oldman&action=oldman_oldman");
    }
    if (
      myClass() === $class`Seal Clubber` &&
      !have($skill`Furious Wallop`) &&
      guildStoreAvailable()
    ) {
      visitUrl("guild.php?action=buyskill&skillid=32", true);
    }
    const stashItems = $items`repaid diaper, Buddy Bjorn, Crown of Thrones, Pantsgiving, mafia pointer finger ring`;
    if (
      myInebriety() <= inebrietyLimit() &&
      (myClass() !== $class`Seal Clubber` || !have($skill`Furious Wallop`))
    ) {
      stashItems.push(...$items`haiku katana, Operation Patriot Shield`);
    }
    if (!have($item`Jurassic Parka`) && have($skill`Torso Awareness`)) {
      stashItems.push($item`origami pasties`);
    }
    // FIXME: Dynamically figure out pointer ring approach.
    withStash(stashItems, () => {
      withVIPClan(() => {
        // 0. diet stuff.
        if (globalOptions.nodiet || get("_garboYachtzeeChainCompleted", false)) {
          print("We should not be yachtzee chaining", "red");
          globalOptions.prefs.yachtzeechain = false;
        }

        if (
          !globalOptions.nodiet &&
          (!globalOptions.prefs.yachtzeechain || get("_garboYachtzeeChainCompleted", false))
        ) {
          runDiet();
        } else if (!globalOptions.simdiet) {
          nonOrganAdventures();
        }

        // 1. make an outfit (amulet coin, pantogram, etc), misc other stuff (VYKEA, songboom, robortender drinks)
        dailySetup();

        const preventEquip = $items`broken champagne bottle, Spooky Putty snake, Spooky Putty mitre, Spooky Putty leotard, Spooky Putty ball, papier-mitre, papier-mâchéte, papier-mâchine gun, papier-masque, papier-mâchuridars, smoke ball, stinky fannypack, dice-shaped backpack`;
        if (globalOptions.quick) {
          // Brimstone equipment explodes the number of maximize combinations
          preventEquip.push(
            ...$items`Brimstone Bludgeon, Brimstone Bunker, Brimstone Brooch, Brimstone Bracelet, Brimstone Boxers, Brimstone Beret`
          );
        }

        setDefaultMaximizeOptions({
          preventEquip: preventEquip,
          preventSlot: $slots`buddy-bjorn, crown-of-thrones`,
        });

        // 2. do some embezzler stuff
        freeFights();
        postFreeFightDailySetup(); // setup stuff that can interfere with free fights (VYKEA)
        yachtzeeChain();
        dailyFights();

        if (!globalOptions.nobarf) {
          // 3. burn turns at barf
          potionSetup(false);
          maximize("MP", false);
          meatMood().execute(estimatedTurns());
          useBuffExtenders();
          try {
            while (canContinue()) {
              barfTurn();
              postCombatActions();
            }

            // buy one-day tickets with FunFunds if user desires
            if (
              globalOptions.prefs.buyPass &&
              availableAmount($item`FunFunds™`) >= 20 &&
              !have($item`one-day ticket to Dinseylandfill`)
            ) {
              print("Buying a one-day ticket", HIGHLIGHT);
              buy(
                $coinmaster`The Dinsey Company Store`,
                1,
                $item`one-day ticket to Dinseylandfill`
              );
            }
          } finally {
            setAutoAttack(0);
          }
        } else setAutoAttack(0);
      });
    });
  } finally {
    propertyManager.resetAll();
    set("garboStashItems", stashItems.map((item) => toInt(item).toFixed(0)).join(","));
    visitUrl(`account.php?actions[]=flag_aabosses&flag_aabosses=${aaBossFlag}&action=Update`, true);
    if (startingGarden && have(startingGarden)) use(startingGarden);
    printEmbezzlerLog();
    printGarboSession();
    printLog(HIGHLIGHT);
  }
  set(completedProperty, `garbo ${argString}`);
}
