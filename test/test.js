const BINARY_MODE = false;
const LOG_SCALE_MODE = false;
const USER_PROFILE_ONLY_FLAG = true;
const MAX_LOAD_USERS = 100;

const MODULE_ID = "TEST_NNT";
const MODULE_ID_PREFIX = "NNT";

const TOTAL_ITERATIONS = 20;

const DEFAULT_USER_PROFILE_ONLY_INPUTS_ID =
  "inputs_25250101_000000_255_profilecharcodes";
const c = DEFAULT_USER_PROFILE_ONLY_INPUTS_ID + ".json";

const ONE_SECOND = 1000;
const ONE_MINUTE = 60 * ONE_SECOND;
const ONE_HOUR = 60 * ONE_MINUTE;
const compactDateTimeFormat = "YYYYMMDD_HHmmss";

import { promises as fsp } from "fs";
import path from "path";
import chalk from "chalk";
import moment from "moment";
import fs from "fs";
import should from "should";
import empty from "is-empty";
import assert from "assert";

import deepcopy from "deepcopy";

const chalkNetwork = chalk.blue;
const chalkBlueBold = chalk.blue.bold;
const chalkTwitter = chalk.blue;
const chalkBlue = chalk.blue;
const chalkGreen = chalk.green;
const chalkError = chalk.bold.red;
const chalkAlert = chalk.red;
const chalkWarn = chalk.yellow;
const chalkLog = chalk.gray;
const chalkInfo = chalk.black;

import async from "async";
import _ from "lodash";
import shuffle from "shuffle-array";
import HashMap from "hashmap";
import yauzl from "yauzl";

import os from "os";
let hostname = os.hostname();
hostname = hostname.replace(/\.example\.com/g, "");
hostname = hostname.replace(/\.local/g, "");
hostname = hostname.replace(/\.home/g, "");
hostname = hostname.replace(/\.at\.net/g, "");
hostname = hostname.replace(/\.fios-router\.home/g, "");
hostname = hostname.replace(/word0-instance-1/g, "google");
hostname = hostname.replace(/word/g, "google");

const statsObj = {};
statsObj.users = {};
statsObj.users.zipHashMapHit = 0;
statsObj.users.zipHashMapMiss = 0;
statsObj.users.unzipped = 0;

import mgt from "@threeceelabs/mongoose-twitter";
global.wordAssoDb = mgt;

const mguAppName = "MGU_" + MODULE_ID;
import MongooseUtilities from "@threeceelabs/mongoose-utilities";
const mgUtils = new MongooseUtilities(mguAppName);

mgUtils.on("ready", async () => {
  console.log(`${MODULE_ID_PREFIX} | +++ MONGOOSE UTILS READY: ${mguAppName}`);
});

let DROPBOX_ROOT_FOLDER;

if (hostname === "google") {
  DROPBOX_ROOT_FOLDER = "/home/tc/Dropbox/Apps/wordAssociation";
} else {
  DROPBOX_ROOT_FOLDER = "/Users/tc/Dropbox/Apps/wordAssociation";
}

const configDefaultFolder = path.join(
  DROPBOX_ROOT_FOLDER,
  "config/utility/default"
);

const configDefaultTestFolder = path.join(
  DROPBOX_ROOT_FOLDER,
  "config/utility/test/testData"
);
const configHostFolder = path.join(
  DROPBOX_ROOT_FOLDER,
  "config/utility",
  hostname
);

const tcuChildName = Number("NNT_TEST_TCU");
import { ThreeceeUtilities } from "@threeceelabs/threeceeutilities";
const tcUtils = new ThreeceeUtilities(tcuChildName);

const jsonPrint = tcUtils.jsonPrint;
const formatCategory = tcUtils.formatCategory;

const testNetworkFolder = path.join(configDefaultTestFolder, "networks");

import { NeuralNetworkTools } from "../index.js";
const nnTools = new NeuralNetworkTools("TEST");
let mongooseDb;

async function loadUsersDb() {
  console.log("... LOADING DB USERS");

  try {
    const userArray = await global.wordAssoDb.User.find({
      categorized: true,
      ignored: false,
    })
      .limit(10)
      .lean();

    console.log(
      chalkInfo(MODULE_ID_PREFIX + " | LOADED DB USERS: " + userArray.length)
    );
    return userArray;
  } catch (err) {
    console.log(
      chalkError(MODULE_ID_PREFIX + " | *** LOAD DB USERS ERROR: " + err)
    );
    throw err;
  }
}

async function loadNetworksDb() {
  console.log("... LOADING DB NETWORKS");

  try {
    const nnArray = await global.wordAssoDb.NeuralNetwork.find({
      successRate: { $gt: 80 },
      networkTechnology: "tensorflow",
    })
      .limit(1)
      .lean();

    console.log(
      chalkInfo(MODULE_ID_PREFIX + " | LOADED DB NETWORKS: " + nnArray.length)
    );
    return nnArray;
  } catch (err) {
    console.log(
      chalkError(MODULE_ID_PREFIX + " | *** LOAD DB NETWORKS ERROR: " + err)
    );
    throw err;
  }
}

let nnArray = [];
let userArray = [];

before(async function () {
  mongooseDb = await mgUtils.connectDb();
  nnArray = await loadNetworksDb();
  userArray = await loadUsersDb();
});

describe("#loadNetwork()", function (done) {
  it("enableTensorflow", async function () {
    await nnTools.enableTensorflow();
  });
  it("loadNetwork", async function () {
    if (empty(nnArray[0].networkJson) && !empty(nnArray[0].network)) {
      nnArray[0].networkJson = nnArray[0].network;
    }
    await nnTools.loadNetwork({ networkObj: nnArray[0] });
  });
  it("activate", async function () {
    const results = await nnTools.activate({
      user: userArray[0],
      convertDatumFlag: true,
      verbose: true,
    });
    console.log({ results });
  });
});
