const MODULE_ID_PREFIX = "NNT";
const DEFAULT_BINARY_MODE = true;
const DEFAULT_USER_PROFILE_ONLY_FLAG = false;
const tcuChildName = MODULE_ID_PREFIX + "_TCU";

const DEFAULT_BRAIN_TRAIN_ERROR = 0.3;
const DEFAULT_BRAIN_TRAIN_ITERATIONS = 1000;
const DEFAULT_BRAIN_TRAIN_LEARNING_RATE = 0.3;
const DEFAULT_BRAIN_TRAIN_MOMENTUM = 0.1;

const os = require("os");
let hostname = os.hostname();
if (hostname.startsWith("mbp3")){
  hostname = "mbp3";
}
hostname = hostname.replace(/.tld/g, ""); // amtrak wifi
hostname = hostname.replace(/.local/g, "");
hostname = hostname.replace(/.home/g, "");
hostname = hostname.replace(/.at.net/g, "");
hostname = hostname.replace(/.fios-router.home/g, "");
hostname = hostname.replace(/word0-instance-1/g, "google");
hostname = hostname.replace(/word-1/g, "google");
hostname = hostname.replace(/word/g, "google");

const carrot = require("@liquid-carrot/carrot");
const neataptic = require("neataptic");
const brain = require("brain.js");

const path = require("path");
const async = require("async");
const util = require("util");
const _ = require("lodash");
const EventEmitter = require("events");
const HashMap = require("hashmap").HashMap;
const defaults = require("object.defaults");
const pick = require("object.pick");
const table = require("text-table");
const empty = require("is-empty");
const objectRenameKeys = require("object-rename-keys");
const networksHashMap = new HashMap();
const inputsHashMap = new HashMap();

const ThreeceeUtilities = require("@threeceelabs/threecee-utilities");
const tcUtils = new ThreeceeUtilities(tcuChildName);

const jsonPrint = tcUtils.jsonPrint;
const indexOfMax = tcUtils.indexOfMax;
const formatBoolean = tcUtils.formatBoolean;
const formatCategory = tcUtils.formatCategory;

const chalk = require("chalk");
const chalkWarn = chalk.yellow;
const chalkAlert = chalk.red;
const chalkError = chalk.bold.red;
const chalkLog = chalk.gray;

let primaryNeuralNetworkId;

const configuration = {};
configuration.userProfileOnlyFlag = DEFAULT_USER_PROFILE_ONLY_FLAG;
configuration.binaryMode = DEFAULT_BINARY_MODE;
configuration.verbose = false;

const statsObj = {};
statsObj.networks = {};
statsObj.bestNetwork = {};
statsObj.currentBestNetwork = {};

let DROPBOX_ROOT_FOLDER;

if (hostname === "google") {
  DROPBOX_ROOT_FOLDER = "/home/tc/Dropbox/Apps/wordAssociation";
}
else {
  DROPBOX_ROOT_FOLDER = "/Users/tc/Dropbox/Apps/wordAssociation";
}

const configDefaultFolder = path.join(DROPBOX_ROOT_FOLDER, "config/utility/default");
const defaultInputsFolder = path.join(configDefaultFolder, "inputs");

const NeuralNetworkTools = function(app_name){
  const self = this;
  this.appname = app_name || "DEFAULT_APP_NAME";
  console.log("NN TOOLS | APP NAME: " + this.appname);

  EventEmitter.call(this);

  self.emit("ready", self.appname);
};

util.inherits(NeuralNetworkTools, EventEmitter);

NeuralNetworkTools.prototype.verbose = function(v){
  if (v === undefined) { return configuration.verbose; }
  configuration.verbose = v;
  console.log(chalkAlert(MODULE_ID_PREFIX + " | --> SET VERBOSE: " + configuration.verbose));
  return;
}

NeuralNetworkTools.prototype.setBinaryMode = function(b){
  if (b === undefined) { return configuration.binaryMode; }
  configuration.binaryMode = b;
  tcUtils.setBinaryMode(b);
  console.log(chalkAlert(MODULE_ID_PREFIX + " | --> SET BINARY MODE: " + configuration.binaryMode));
  return;
}

NeuralNetworkTools.prototype.getBinaryMode = function(){
  return configuration.binaryMode;
}

NeuralNetworkTools.prototype.setUserProfileOnlyFlag = function(f){
  if (f === undefined) { return configuration.userProfileOnlyFlag; }
  configuration.userProfileOnlyFlag = f;
  tcUtils.setUserProfileOnlyFlag(f);
  console.log(chalkAlert(MODULE_ID_PREFIX + " | --> SET USER PROFILE ONLY FLAG: " + configuration.userProfileOnlyFlag));
  return;
}

NeuralNetworkTools.prototype.getUserProfileOnlyFlag = function(){
  return configuration.userProfileOnlyFlag;
}

NeuralNetworkTools.prototype.setMaxInputHashMap = function(m){
  return new Promise(function(resolve){
    tcUtils.setMaxInputHashMap(m);
    console.log(chalkLog(MODULE_ID_PREFIX + " | --> SET MAX INPUT HASHMAP: " + Object.keys(tcUtils.getMaxInputHashMap())));
    resolve();
  });
}

NeuralNetworkTools.prototype.getMaxInputHashMap = function(){
  return tcUtils.getMaxInputHashMap();
}

NeuralNetworkTools.prototype.setNormalization = function(n){
  return new Promise(function(resolve){
    tcUtils.setNormalization(n);
    console.log(chalkLog(MODULE_ID_PREFIX + " | --> SET NORMALIZATION\n" + jsonPrint(tcUtils.getNormalization())));
    resolve();
  });
}

NeuralNetworkTools.prototype.getNormalization = function(){
  const normalization = tcUtils.getNormalization();
  return normalization;
}

NeuralNetworkTools.prototype.getNumberNetworks = function(){
  const numNetworks = networksHashMap.size;
  return numNetworks;
}

const networkDefaults = {};

networkDefaults.rank = Infinity;
networkDefaults.previousRank = Infinity;
networkDefaults.matchRate = 0;
networkDefaults.overallMatchRate = 0;
networkDefaults.successRate = 0;
networkDefaults.testCycles = 0;
networkDefaults.testCycleHistory = [];

networkDefaults.meta = {};

networkDefaults.meta.category = "none";
networkDefaults.meta.categoryAuto = "none";
networkDefaults.meta.binaryMode = configuration.binaryMode;
networkDefaults.meta.userProfileOnlyFlag = configuration.userProfileOnlyFlag;
networkDefaults.meta.output = [0,0,0];
networkDefaults.meta.total = 0;
networkDefaults.meta.match = 0;
networkDefaults.meta.mismatch = 0;
networkDefaults.meta.matchFlag = false;

networkDefaults.meta.left = 0;
networkDefaults.meta.neutral = 0;
networkDefaults.meta.right = 0;
networkDefaults.meta.none = 0;
networkDefaults.meta.positive = 0;
networkDefaults.meta.negative = 0;

const networkPickArray = [
  "inputsId",
  // "inputsObj",
  "matchRate",
  "matchFlag",
  "meta",
  "networkId",
  "networkTechnology",
  "numInputs",
  "numOutputs",
  "output",
  "overallMatchRate",
  "rank",
  "previousRank",
  "seedNetworkId",
  "seedNetworkRes",
  "successRate",
  "testCycleHistory",
  "testCycles",
];

NeuralNetworkTools.prototype.loadInputs = async function(params){
  await tcUtils.loadInputs({inputsObj: params.inputsObj});
  return;
}

NeuralNetworkTools.prototype.loadNetwork = async function(params){

  if (empty(params.networkObj)) {
    console.log(chalkError(MODULE_ID_PREFIX + " | *** LOAD NETWORK UNDEFINED: " + params.networkObj));
    throw new Error(MODULE_ID_PREFIX + " | LOAD NETWORK UNDEFINED");
  }

  if (empty(params.networkObj.network) && empty(params.networkObj.networkJson)) {
    console.log(chalkError(MODULE_ID_PREFIX + " | *** LOAD NETWORK JSON UNDEFINED: " + params.networkObj.networkId));
    throw new Error(MODULE_ID_PREFIX + " | LOAD NETWORK JSON UNDEFINED");
  }

  try{

    const nn = params.networkObj;

    nn.meta = defaults(nn.meta, networkDefaults.meta);

    statsObj.networks[nn.networkId] = {};
    statsObj.networks[nn.networkId] = pick(nn, networkPickArray);

    if (empty(statsObj.bestNetwork)) {
      statsObj.bestNetwork = {};
      statsObj.bestNetwork = pick(nn, networkPickArray);
    }

    if (empty(statsObj.currentBestNetwork)) {
      statsObj.currentBestNetwork = {};
      statsObj.currentBestNetwork = pick(nn, networkPickArray);
    }

    if (params.isBestNetwork || (statsObj.bestNetwork.overallMatchRate < nn.overallMatchRate)) {
      printNetworkObj(MODULE_ID_PREFIX + " | --> LOAD BEST NETWORK", nn, chalk.green);
      statsObj.bestNetwork = pick(nn, networkPickArray);
    }

    if (statsObj.currentBestNetwork.overallMatchRate < nn.overallMatchRate){
      printNetworkObj(MODULE_ID_PREFIX + " | --> LOAD CURRENT BEST NETWORK", nn, chalk.green);
      statsObj.currentBestNetwork = pick(nn, networkPickArray);
    }

    let network;

    if (nn.networkTechnology === "brain"){
      console.log(chalkWarn(MODULE_ID_PREFIX + " | ... LOAD NETWORK RAW | TECH: " + nn.networkTechnology + " | " + nn.networkId));

      if (params.networkIsRaw) {
        console.log(chalkWarn(MODULE_ID_PREFIX + " | ... LOAD NETWORK RAW | TECH: " + nn.networkTechnology + " | " + nn.networkId));
        network = nn.network;
      }
      else{
        console.log(chalkWarn(MODULE_ID_PREFIX + " | ... CONVERT+LOAD NETWORK FROM JSON | TECH: " + nn.networkTechnology + " | " + nn.networkId));

        if (!empty(nn.networkJson)) {
          network = new brain.NeuralNetwork();
          network.fromJSON(nn.networkJson);
        }
        else if (!empty(nn.network)) {
          network = new brain.NeuralNetwork();
          network.fromJSON(nn.network);
        }
        else{
          console.log(chalkError(MODULE_ID_PREFIX + " | *** LOAD NETWORK FROM JSON ERROR | NO JSON??? | TECH: " + nn.networkTechnology + " | " + nn.networkId));
        }
      }
    }
    else if (nn.networkTechnology === "carrot"){
      console.log(chalkWarn(MODULE_ID_PREFIX + " | ... LOAD NETWORK RAW | TECH: " + nn.networkTechnology + " | " + nn.networkId));

      if (params.networkIsRaw) {
        console.log(chalkWarn(MODULE_ID_PREFIX + " | ... LOAD NETWORK RAW | TECH: " + nn.networkTechnology + " | " + nn.networkId));
        network = nn.network;
      }
      else{
        console.log(chalkWarn(MODULE_ID_PREFIX + " | ... CONVERT+LOAD NETWORK FROM JSON | TECH: " + nn.networkTechnology + " | " + nn.networkId));

        if (!empty(nn.networkJson)) {
          
          // catch errors due to toJSON() and fromJSON() bugs in carrot

          if (nn.networkJson.input && !nn.networkJson.input_size) {
            console.log(chalkAlert(MODULE_ID_PREFIX + " | !!! INPUT SIZE UNDEFINED | SETTING TO nn.networkJson.input"
              + " | nn.networkId: " + nn.networkId
              + " | nn.inputsId: " + nn.inputsId
              + " | nn.numInputs: " + nn.numInputs
              + " | nn.networkJson.input: " + nn.networkJson.input
              + " | nn.networkJson.input_size: " + nn.networkJson.input_size
            ));
            nn.networkJson.input_size = nn.networkJson.input;
          }

          if (nn.networkJson.output && !nn.networkJson.output_size) {
            console.log(chalkAlert(MODULE_ID_PREFIX + " | !!! OUTPUT SIZE UNDEFINED | SETTING TO nn.networkJson.output"
              + " | nn.networkId: " + nn.networkId
              + " | nn.numOutputs: " + nn.numOutputs
              + " | nn.networkJson.output: " + nn.networkJson.output
              + " | nn.networkJson.output_size: " + nn.networkJson.output_size
            ));
            nn.networkJson.output_size = nn.networkJson.output;
          }

          if (!nn.networkJson.input_nodes) {

            nn.networkJson.input_nodes = [];

            nn.networkJson.nodes.forEach(function(node, index){
              if (node.type === "input"){
                nn.networkJson.input_nodes.push(index);
              }
            });

          }

          if (!nn.networkJson.output_nodes) {
            nn.networkJson.output_nodes = [];

            nn.networkJson.nodes.forEach(function(node, index){
              if (node.type === "output"){
                nn.networkJson.output_nodes.push(index);
              }
            });

          }

          if (nn.networkJson.input_nodes.length !== nn.networkJson.input_size){
            console.log(chalkError(MODULE_ID_PREFIX + " | *** INPUT NODES ERROR | " + nn.networkId + " | LENGTH: " + nn.networkJson.input_nodes.length));
            throw new Error("INPUT NODES LENGTH: " + nn.networkJson.input_nodes.length);
          }

          if (nn.networkJson.input_nodes.length <= 1){
            console.log(chalkError(MODULE_ID_PREFIX + " | *** INPUT NODES ERROR | " + nn.networkId + " | LENGTH: " + nn.networkJson.input_nodes.length));
            throw new Error("INPUT NODES LENGTH: " + nn.networkJson.input_nodes.length);
          }

          if (nn.networkJson.output_nodes.length !== nn.networkJson.output_size){
            console.log(chalkError(MODULE_ID_PREFIX + " | *** OUTPUT NODES ERROR | " + nn.networkId + " | LENGTH: " + nn.networkJson.output_nodes.length));
            throw new Error("OUTPUT NODES LENGTH: " + nn.networkJson.output_nodes.length);
          }

          network = carrot.Network.fromJSON(nn.networkJson);
        }
        else if (!empty(nn.network)) {
          network = carrot.Network.fromJSON(nn.network);
        }
        else{
          console.log(chalkError(MODULE_ID_PREFIX + " | *** LOAD NETWORK FROM JSON ERROR | NO JSON??? | TECH: " + nn.networkTechnology + " | " + nn.networkId));
        }
      }
    }
    else if (nn.networkTechnology === "neataptic"){
      if (params.networkIsRaw) {
        console.log(chalkWarn(MODULE_ID_PREFIX + " | ... LOAD NETWORK RAW | TECH: " + nn.networkTechnology + " | " + nn.networkId));
        network = nn.network;
      }
      else{
        console.log(chalkWarn(MODULE_ID_PREFIX + " | ... CONVERT+LOAD NETWORK FROM JSON | TECH: " + nn.networkTechnology + " | " + nn.networkId));

        if (!empty(nn.networkJson)) {
          network = neataptic.Network.fromJSON(nn.networkJson);
        }
        else if (!empty(nn.network)) {
          network = neataptic.Network.fromJSON(nn.network);
        }
        else{
          console.log(chalkError(MODULE_ID_PREFIX + " | *** LOAD NETWORK FROM JSON ERROR | NO JSON??? | TECH: " + nn.networkTechnology + " | " + nn.networkId));
        }
      }
    }
    else {
      nn.networkTechnology = "neataptic";
      console.log(chalkAlert(MODULE_ID_PREFIX + " | ??? TRY CONVERT+LOAD NETWORK FROM JSON | ??? TECH: " + nn.networkTechnology + " | " + nn.networkId));
      try{
        network = neataptic.Network.fromJSON(nn.network);
      }
      catch(err){
        console.log(chalkAlert(MODULE_ID_PREFIX + " | ??? TRY LOAD NETWORK FROM JSON | ??? TECH: " + nn.networkTechnology + " | " + nn.networkId));
        network = nn.network;
      }
    }

    nn.network = {};
    nn.network = network;
    nn.networkRawFlag = true;


    try{
      let inputsObj = nn.inputsObj;

      if (empty(inputsObj)){
        // (chalkAlert(MODULE_ID_PREFIX + " | !!! NN INPUTS OBJ UNDEFINED | NN: " + nn.networkId + " | INPUTS ID: " + nn.inputsId));

        inputsObj = await global.wordAssoDb.NetworkInputs.findOne({inputsId: nn.inputsId});

        if (empty(inputsObj)){

          console.log(chalkAlert(MODULE_ID_PREFIX + " | !!! NN INPUTS OBJ NOT FOUND IN DB ... TRY FILE | NN: " + nn.inputsId));

          inputsObj = await tcUtils.loadFileRetry({
            folder: defaultInputsFolder, 
            file: nn.inputsId + ".json",
            resolveOnNotFound: false
          });
        }
      }

      inputsHashMap.set(nn.inputsId, inputsObj);

      await tcUtils.loadInputs({inputsObj: inputsObj});
      delete nn.inputsObj; // save memory

      networksHashMap.set(nn.networkId, nn);

      console.log(chalkLog(MODULE_ID_PREFIX + " | --> LOAD NN: " + nn.networkId + " | " + networksHashMap.size + " NNs"));
      console.log(chalkLog(MODULE_ID_PREFIX + " | --> LOAD IN: " + nn.inputsId + " | " + inputsHashMap.size + " INPUT OBJs"));

      return nn.networkId;
    }
    catch(err){
      console.log(chalkError(MODULE_ID_PREFIX + " | *** LOAD INPUTS ERROR"
        + " | NN ID: " + nn.networkId
        + " | INPUTS ID: " + nn.inputsId
        + " | " + err
      ));
      throw err;
    }

  }
  catch(err){
    console.log(chalkError(MODULE_ID_PREFIX + " | *** LOAD NN ERROR"
      + " | NN ID: " + params.networkObj.networkId
      + " | IN ID: " + params.networkObj.inputsId
      + " | " + err
    ));
    throw err;
  }
}

NeuralNetworkTools.prototype.deleteAllNetworks = async function(){

  try{

    console.log(chalkError(MODULE_ID_PREFIX + " | XXX DELETE ALL NETWORKS"));

    networksHashMap.clear();

    statsObj.networks = {};
    primaryNeuralNetworkId = false;
    statsObj.bestNetwork = {};
    statsObj.currentBestNetwork = {};

    return;

  }
  catch(err){
    console.log(chalkError(MODULE_ID_PREFIX + " | *** DELETE ALL NN ERROR"
      + " | " + err
    ));
    throw err;
  }
}

NeuralNetworkTools.prototype.deleteNetwork = async function(params){

  if (!params.networkId) {
    console.log(chalkError(MODULE_ID_PREFIX + " | *** DELETE NETWORK ID UNDEFINED: " + params.networkId));
    throw new Error(MODULE_ID_PREFIX + " | DELETE NETWORK ID UNDEFINED");
  }

  try{

    console.log(chalkError(MODULE_ID_PREFIX + " | XXX DELETE NETWORK: " + params.networkId));

    networksHashMap.delete(params.networkId);

    delete statsObj.networks[params.networkId];

    if (primaryNeuralNetworkId == params.networkId){
      console.log(chalkError(MODULE_ID_PREFIX + " | XXX DELETE PRIMARY NETWORK: " + params.networkId));
      primaryNeuralNetworkId = false;
    }

    if (statsObj.bestNetwork && (statsObj.bestNetwork !== undefined) && (statsObj.bestNetwork.networkId == params.networkId)){
      console.log(chalkError(MODULE_ID_PREFIX + " | XXX DELETE BEST NETWORK: " + params.networkId));
      delete statsObj.bestNetwork;
    }

    if (statsObj.currentBestNetwork && (statsObj.currentBestNetwork !== undefined) && (statsObj.currentBestNetwork.networkId == params.networkId)){
      console.log(chalkError(MODULE_ID_PREFIX + " | XXX DELETE CURRENT BEST NETWORK: " + params.networkId));
      delete statsObj.currentBestNetwork;
    }

    return;

  }
  catch(err){
    console.log(chalkError(MODULE_ID_PREFIX + " | *** DELETE NN ERROR"
      + " | NN ID: " + params.networkId
      + " | " + err
    ));
    throw err;
  }
}

const deleteNetwork = NeuralNetworkTools.prototype.deleteNetwork;

NeuralNetworkTools.prototype.setPrimaryInputs = async function(inputsId){
  await tcUtils.setPrimaryInputs({inputsId: inputsId});
}

NeuralNetworkTools.prototype.setPrimaryNeuralNetwork = async function(nnId){

  if (!nnId || nnId === undefined) {
    console.log(chalkError(MODULE_ID_PREFIX + " | *** PRIMARY NETWORK ID UNDEFINED: " + nnId));
    return new Error(MODULE_ID_PREFIX + " | PRIMARY NETWORK ID UNDEFINED");
  }

  if (!networksHashMap.has(nnId)){
    console.log(chalkError(MODULE_ID_PREFIX + " | *** PRIMARY NETWORK NOT LOADED: " + nnId));
    return new Error(MODULE_ID_PREFIX + " | PRIMARY NETWORK NOT LOADED: " + nnId);
  }

  primaryNeuralNetworkId = nnId;
  const nnObj = networksHashMap.get(primaryNeuralNetworkId);

  if (!inputsHashMap.has(nnObj.inputsId)){
    console.log(chalkError(MODULE_ID_PREFIX + " | *** setPrimaryNeuralNetwork PRIMARY NETWORK INPUTS NOT IN HASHMAP: " + nnObj.inputsId));
    return new Error(MODULE_ID_PREFIX + " | PRIMARY NETWORK INPUTS NOT IN HASHMAP: " + nnObj.inputsId);
  }

  await tcUtils.setPrimaryInputs({inputsId: nnObj.inputsId});

  console.log(chalkLog(MODULE_ID_PREFIX + " | --> SET PRIMARY NN: " + primaryNeuralNetworkId));

  return primaryNeuralNetworkId;
}

NeuralNetworkTools.prototype.getPrimaryNeuralNetwork = function(){
  return primaryNeuralNetworkId;
}

let previousPrintedNetworkObj = {};
function outputNetworkInputText(params){
  if (params.truncated){
    console.log(chalkLog(
      params.hits + " / " + params.inputArraySize + " | HIT RATE: " + params.hitRate.toFixed(2) + "% | " + params.title
    ));
    return;
  }
  console.log(chalkLog(
    "______________________________________________________________________________________________________________________________________"
    + "\n" + params.hits + " / " + params.inputArraySize + " | HIT RATE: " + params.hitRate.toFixed(2) + "% | " + params.title
    + "\n" + params.text
  ));
}

NeuralNetworkTools.prototype.printNetworkInput = function(params){

  return new Promise(function(resolve, reject){

    if (!params.datum.input || params.datum.input === undefined){
      console.log(chalkError(MODULE_ID_PREFIX + " | *** printNetworkInput ERROR | datum.input UNDEFINED"));
      return reject();
    }

    const inputArray = params.datum.input;
    const nameArray = params.datum.name;
    const columns = params.columns || 100;

    let col = 0;
    let hitRowArray = [];

    let inputText = ".";
    let text = "";
    let textRow = "";
    let hits = 0;
    let hitRate = 0;
    const inputArraySize = inputArray.length;

    previousPrintedNetworkObj.truncated = false;

    async.eachOfSeries(inputArray, function(input, index, cb){

      if (input) {
        inputText = "X";
        hits += 1;
        hitRate = 100 * hits / inputArraySize;
        hitRowArray.push(nameArray[index]);
      }
      else {
        inputText = ".";
      }

      textRow += inputText;
      col += 1;

      if ((col === columns) || (index === inputArraySize)){

        text += textRow;
        text += " | " + hitRowArray;
        text += "\n";

        textRow = "";
        col = 0;
        hitRowArray = [];
      }

      cb();

    }, function(err){
      if (err) {
        console.log(chalkError(MODULE_ID_PREFIX + " | *** printNetworkInput ERROR: " + err));
        return reject(err);
      }

      previousPrintedNetworkObj = {
        title: params.title,
        inputsId: params.datum.inputsId,
        text: text,
        hits: hits,
        inputArraySize: inputArraySize,
        hitRate: hitRate,
        truncated: false
      };

      outputNetworkInputText(previousPrintedNetworkObj);
      resolve();
    });

  });
}

let titleDefault;

NeuralNetworkTools.prototype.printNetworkResults = function(p){

  const statsTextArray = [];

  return new Promise(function(resolve, reject){

    const params = p || {};

    statsObj.currentBestNetwork = defaults(statsObj.currentBestNetwork, networkDefaults);

    titleDefault = "BEST"
      + " | TECH: " + statsObj.currentBestNetwork.networkTechnology.charAt(0).toUpperCase()
      + " | BIN: " + formatBoolean(statsObj.currentBestNetwork.meta.binaryMode)
      + " | PROF ONLY: NN: " + formatBoolean(statsObj.currentBestNetwork.meta.userProfileOnlyFlag)
      + " - CONFIG: " + formatBoolean(configuration.userProfileOnlyFlag)
      + " | RANK: " + statsObj.currentBestNetwork.rank
      + " PREV: " + statsObj.currentBestNetwork.previousRank
      + " | " + statsObj.currentBestNetwork.networkId
      + " | " + statsObj.currentBestNetwork.inputsId
      + " | " + statsObj.currentBestNetwork.meta.match + "/" + statsObj.currentBestNetwork.meta.total
      + " | MR: " + statsObj.currentBestNetwork.matchRate.toFixed(2) + "%"
      + " | OUT: " + statsObj.currentBestNetwork.meta.output
      + " | CM: " + formatCategory(statsObj.currentBestNetwork.meta.category)
      + " A: " + formatCategory(statsObj.currentBestNetwork.meta.categoryAuto)
      + " | MATCH: " + formatBoolean(statsObj.currentBestNetwork.meta.matchFlag);

    if (!params.title) { params.title = titleDefault; }

    const sortedNetworksArray = _.sortBy(networksHashMap.values(), ["matchRate"]);
    _.reverse(sortedNetworksArray);

    async.eachOfSeries(sortedNetworksArray, function(n, index, cb0){

      const nn = defaults(n, networkDefaults);
      nn.meta = defaults(n.meta, networkDefaults.meta);

      statsTextArray[index] = [];
      statsTextArray[index] = [
        MODULE_ID_PREFIX + " | ",
        nn.rank,
        nn.previousRank,
        nn.networkTechnology,
        nn.networkId,
        nn.inputsId,
        nn.numInputs,
        nn.overallMatchRate.toFixed(2),
        nn.successRate.toFixed(2),
        nn.testCycles,
        nn.testCycleHistory.length,
        nn.meta.matchFlag,
        nn.meta.binaryMode,
        nn.meta.userProfileOnlyFlag,
        nn.meta.output,
        nn.meta.total,
        nn.meta.match,
        nn.meta.mismatch,
        nn.matchRate.toFixed(2),
      ];

      cb0();

    }, function(err){

      if (err) {
        console.log(chalkError("TNN | *** printNetworkResults ERROR: " + err));
        return reject(err);
      }

      statsTextArray.unshift([
        MODULE_ID_PREFIX + " | ",
        "RANK",
        "PREV RANK",
        "TECH",
        "NNID",
        "INPUTSID",
        "INPUTS",
        "OAMR",
        "SR",
        "TCs",
        "TCH",
        "MFLAG",
        "BIN",
        "UPOF",
        "OUTPUT",
        "TOT",
        " M",
        " MM",
        " MR"
      ]);

      console.log(chalk.blue(
          "\nNNT | -------------------------------------------------------------------------------------------------------------------------------------------------"
        + "\nNNT | " + params.title 
        + "\nNNT | -------------------------------------------------------------------------------------------------------------------------------------------------\n"
        + table(statsTextArray, { align: ["l", "r", "r", "l", "l", "l", "r", "r", "r", "r", "r", "l", "l", "l", "r", "r", "r", "r", "r"] })
        + "\nNNT | -------------------------------------------------------------------------------------------------------------------------------------------------"
      ));

      resolve(statsTextArray);

    });

  });
}

const printNetworkInput = NeuralNetworkTools.prototype.printNetworkInput;

function arrayToCategory(arr){
  if (_.isEqual(arr, [0,0,0])) { return "none"; }
  if (_.isEqual(arr, [1,0,0])) { return "left"; }
  if (_.isEqual(arr, [0,1,0])) { return "neutral"; }
  if (_.isEqual(arr, [0,0,1])) { return "right"; }
  throw new Error("INVALID ARR arrayToCategory");
}

function printNetworkObj(title, nn, format) {

  const chalkFormat = (format !== undefined) ? format : chalk.blue;
  const rank = (nn.rank !== undefined) ? nn.rank : Infinity;
  const previousRank = (nn.previousRank !== undefined) ? nn.previousRank : Infinity;
  const overallMatchRate = nn.overallMatchRate || 0;
  const matchRate = nn.matchRate || 0;
  const successRate = nn.successRate || 0;
  const testCycleHistory = nn.testCycleHistory || [];

  console.log(chalkFormat(title
    + " | RK: " + rank
    + " | PREV RK: " + previousRank
    + " | OR: " + overallMatchRate.toFixed(2) + "%"
    + " | MR: " + matchRate.toFixed(2) + "%"
    + " | SR: " + successRate.toFixed(2) + "%"
    + " | CR: " + tcUtils.getTimeStamp(nn.createdAt)
    + " | TC:  " + nn.testCycles
    + " | TH: " + testCycleHistory.length
    + " |  " + nn.inputsId
    + " | " + nn.networkId
  ));

  return;
}

NeuralNetworkTools.prototype.getNetworkStats = function (){
  return new Promise(function(resolve){
    resolve(statsObj);
  });
}

NeuralNetworkTools.prototype.updateNetworkStats = function (params){

  return new Promise(function(resolve, reject){

    if (!params.networkOutput || params.networkOutput === undefined) {
      return reject(new Error("params networkOutput undefined"));
    }

    const primaryNetwork = params.primaryNetwork || false; // 
    const verbose = params.verbose || false; //
    const sortByMetric = params.sortBy || "matchRate";
    // const updateRank = params.updateRank || true;

    let networkOutput = {};

    if (primaryNetwork) {
      networkOutput[params.networkOutput.nnId] = {};
      networkOutput[params.networkOutput.nnId] = params.networkOutput;
    }
    else {
      networkOutput = params.networkOutput;
    }

    const user = params.user; 

    const nnIdArray = Object.keys(networkOutput);

    let chalkCategory = chalk.gray;

    async.eachSeries(nnIdArray, function(nnId, cb){

      let nn = networksHashMap.get(nnId);

      if (!nn || nn === undefined) {
        return reject(new Error(MODULE_ID_PREFIX + " | updateNetworkStats NN UNDEFINED | NN ID: " + nnId));
      }

      nn = defaults(nn, networkDefaults);
      nn.meta = defaults(nn.meta, networkDefaults.meta);

      if (!statsObj.networks[nnId] || statsObj.networks[nnId] === undefined || statsObj.networks[nnId] === {}) {
        statsObj.networks[nnId] = {};
        statsObj.networks[nnId] = networkDefaults;
      }

      statsObj.networks[nnId] = pick(nn, networkPickArray);
      statsObj.networks[nnId].meta = nn.meta;
      
      statsObj.networks[nnId].category = user.category;
      statsObj.networks[nnId].categoryAuto = arrayToCategory(networkOutput[nnId].output);
      
      statsObj.networks[nnId].meta.category = user.category;
      statsObj.networks[nnId].meta.categoryAuto = statsObj.networks[nnId].categoryAuto;
      statsObj.networks[nnId].meta.matchFlag = false;

      networkOutput[nnId].category = user.category;
      networkOutput[nnId].categoryAuto = statsObj.networks[nnId].categoryAuto;

      statsObj.networks[nnId].meta.output = [];
      statsObj.networks[nnId].meta.output = networkOutput[nnId].output;

      if(!user.category || user.category === undefined || user.category === "none"){
        user.category = "none";
        statsObj.networks[nnId].meta.none += 1;
      }
      else{

        statsObj.networks[nnId].meta[user.category] += 1;
        statsObj.networks[nnId].meta.total += 1;

        if (user.category === networkOutput[nnId].categoryAuto) {
          statsObj.networks[nnId].meta.match += 1;
          statsObj.networks[nnId].meta.matchFlag = "MATCH";
          chalkCategory = chalk.green;
        }
        else {
          statsObj.networks[nnId].meta.mismatch += 1;
          statsObj.networks[nnId].meta.matchFlag = "MISS";
          chalkCategory = chalk.gray;
        }
      }

      if (verbose){
        console.log(chalkCategory(MODULE_ID_PREFIX + " | " + statsObj.networks[nnId].meta.matchFlag
          + " | @" + user.screenName
          + " | CM: " + formatCategory(user.category) + " | CA: " + formatCategory(networkOutput[nnId].categoryAuto)
          + " | " + statsObj.networks[nnId].networkId
          + " | " + statsObj.networks[nnId].inputsId
          + " | SR: " + statsObj.networks[nnId].successRate.toFixed(2) 
          + " | MR: " + statsObj.networks[nnId].matchRate.toFixed(2) 
          + " | OR: " + statsObj.networks[nnId].overallMatchRate.toFixed(2) 
        ));
      }

      if (statsObj.networks[nnId].meta.total === 0) {
        statsObj.networks[nnId].matchRate = 0;
      }
      else {
        statsObj.networks[nnId].matchRate = 100.0 * statsObj.networks[nnId].meta.match / statsObj.networks[nnId].meta.total;
      }

      nn.rank = statsObj.networks[nnId].rank;
      nn.previousRank = statsObj.networks[nnId].previousRank;
      nn.matchRate = statsObj.networks[nnId].matchRate;
      nn.overallMatchRate = statsObj.networks[nnId].overallMatchRate;
      nn.testCycleHistory = statsObj.networks[nnId].testCycleHistory;
      nn.testCycles = statsObj.networks[nnId].testCycles;
      nn.output = statsObj.networks[nnId].meta.output;
      nn.meta = statsObj.networks[nnId].meta;

      networksHashMap.set(nnId, nn);

      cb();

    }, function(err2){

      if (err2) {
        return reject(err2);
      }

        const sortedNetworksArray = _.sortBy(networksHashMap.values(), [sortByMetric]);
        _.reverse(sortedNetworksArray);

        async.eachOfSeries(sortedNetworksArray, function(nn, index, cb1){

          nn.rank = index;

          networksHashMap.set(nn.networkId, nn);

          if (index === 0){
            if ((statsObj.currentBestNetwork.networkId !== nn.networkId) && (statsObj.currentBestNetwork.matchRate < nn.matchRate)) {
              printNetworkObj(MODULE_ID_PREFIX + " | +++ NEW CURRENT BEST NETWORK    | " + nn.meta.match + "/" + nn.meta.total, nn, chalk.green);
            }
            statsObj.currentBestNetwork = pick(nn, networkPickArray);
            // statsObj.currentBestNetwork.meta = pick(nn.meta, networkMetaPickArray);
          }

          cb1();

        }, function(err1){

          if (err1) {
            return reject(err1);
          }

          resolve(statsObj.currentBestNetwork);
        });

    });
  });
}

NeuralNetworkTools.prototype.convertNetwork = function(params){

  return new Promise(function(resolve, reject){

    const nnObj = params.networkObj;

    if (empty(nnObj.network) && empty(nnObj.networkJson)) {
      console.log(chalkError(MODULE_ID_PREFIX + " | *** NO OLD NET or JSON EXIST | TECH: " + nnObj.networkTechnology + " | " + nnObj.networkId));
      reject(new Error("NO JSON NETWORK"));
    }
    else if (!empty(nnObj.networkJson)) {

      console.log(chalkLog(MODULE_ID_PREFIX + " | JSON EXISTS | TECH: " + nnObj.networkTechnology + " | " + nnObj.networkId));

      if (nnObj.networkTechnology === "carrot") {

        if (!empty(nnObj.networkJson)) {
          
          // catch errors due to toJSON() and fromJSON() bugs in carrot

          if (nnObj.networkJson.input && !nnObj.networkJson.input_size) {
            nnObj.networkJson.input_size = nnObj.networkJson.input;
          }

          if (nnObj.networkJson.output && !nnObj.networkJson.output_size) {
            nnObj.networkJson.output_size = nnObj.networkJson.output;
          }

          if (!nnObj.networkJson.input_nodes) {

            nnObj.networkJson.input_nodes = [];

            nnObj.networkJson.nodes.forEach(function(node, index){
              if (node.type === "input"){
                nnObj.networkJson.input_nodes.push(index);
              }
            });

          }

          if (!nnObj.networkJson.output_nodes) {
            nnObj.networkJson.output_nodes = [];

            nnObj.networkJson.nodes.forEach(function(node, index){
              if (node.type === "output"){
                nnObj.networkJson.output_nodes.push(index);
              }
            });

          }

          if (nnObj.networkJson.input_nodes.length !== nnObj.networkJson.input_size){
            // throw new Error("INPUT NODES LENGTH: " + nnObj.networkJson.input_nodes.length);
            console.log(chalkError(MODULE_ID_PREFIX + " | *** INPUT NODES ERROR | " + nnObj.networkId + " | LENGTH: " + nnObj.networkJson.input_nodes.length));
          }

          if (nnObj.networkJson.input_nodes.length <= 1){
            console.log(chalkError(MODULE_ID_PREFIX + " | *** INPUT NODES ERROR | " + nnObj.networkId + " | LENGTH: " + nnObj.networkJson.input_nodes.length));
            throw new Error("INPUT NODES LENGTH: " + nnObj.networkJson.input_nodes.length);
          }

          if (nnObj.networkJson.output_nodes.length !== nnObj.networkJson.output_size){
            // throw new Error("OUTPUT NODES LENGTH: " + nnObj.networkJson.output_nodes.length);
          }

          nnObj.networkRaw = carrot.Network.fromJSON(nnObj.networkJson);
        }
      }
      else if (nnObj.networkTechnology === "brain") {
        if (!empty(nnObj.networkJson)) {
          nnObj.networkRaw = brain.NeuralNetwork.fromJSON(nnObj.networkJson);
        }
        else if (!empty(nnObj.network)) {
          nnObj.networkRaw = brain.NeuralNetwork.fromJSON(nnObj.network);
        }
      }
      else {
        if (!empty(nnObj.networkJson)) {
          nnObj.networkRaw = neataptic.Network.fromJSON(nnObj.networkJson);
        }
        else if (!empty(nnObj.network)) {
          nnObj.networkRaw = neataptic.Network.fromJSON(nnObj.network);
        }
      }

      resolve(nnObj);
    }
    else if (!empty(nnObj.network)) {
      console.log(chalkLog(MODULE_ID_PREFIX + " | OLD JSON EXISTS | TECH: " + nnObj.networkTechnology + " | " + nnObj.networkId));
      const newNetObj = objectRenameKeys(nnObj, {network: "networkJson"});

      if (nnObj.networkTechnology === "carrot") {
        newNetObj.networkRaw = carrot.Network.fromJSON(newNetObj.networkJson);
      }
      else if (nnObj.networkTechnology === "brain") {
        newNetObj.networkRaw = brain.NeuralNetwork.fromJSON(newNetObj.networkJson);
      }
      else {
        newNetObj.networkRaw = neataptic.Network.fromJSON(newNetObj.networkJson);
      }

      resolve(newNetObj);
    }
    else{
      reject(new Error("NO VALID JSON NN: " + nnObj.networkId));
    }

  });
}

NeuralNetworkTools.prototype.streamTrainNetwork = async function (params) {

  return new Promise(function(resolve){

    const network = params.network;
    const trainingSet = params.trainingSet;

    const DEFAULT_BRAIN_TRAIN_SCHEDULE = function(data){
      console.log(MODULE_ID_PREFIX +" streamTrainNetwork | ", data);
    };

    const errorThresh = params.options.error || DEFAULT_BRAIN_TRAIN_ERROR;
    const iterations = params.options.iterations || DEFAULT_BRAIN_TRAIN_ITERATIONS;
    const learningRate = params.options.learningRate || DEFAULT_BRAIN_TRAIN_LEARNING_RATE;
    const momentum = params.options.momentum || DEFAULT_BRAIN_TRAIN_MOMENTUM;
    const schedule = params.options.schedule || DEFAULT_BRAIN_TRAIN_SCHEDULE;

    const trainStream = new brain.TrainStream({
      callback: schedule,
      callbackPeriod: 1,
      errorThresh: errorThresh,
      iterations: iterations,
      learningRate: learningRate,
      momentum: momentum,
      neuralNetwork: network,

      floodCallback: function() {
        readInputs(trainStream, trainingSet);
      },

      doneTrainingCallback: function(stats) {
        console.log(chalkLog(MODULE_ID_PREFIX + " | STREAM TRAINING DONE"
          + " | " + params.networkId
          + "\n" + jsonPrint(stats)
        ));
        resolve({network: network, stats: stats});
      }

    });

    // kick it off
    readInputs(trainStream, trainingSet);

    function readInputs(stream, trainingSet) {
      for (let i = 0; i < trainingSet.length; i++) {
        const datum = {input: trainingSet[i].input, output: trainingSet[i].output};
        stream.write(datum);
      }
      // let it know we've reached the end of the inputs
      stream.endInputs();
    }
  });
}

NeuralNetworkTools.prototype.activateSingleNetwork = async function (params) {

  // const activateParams = {
  //   user: datum.user, 
  //   datum: datum, (user, input, output)
  //   convertDatumFlag: convertDatumFlag, 
  //   binaryMode: binaryMode, 
  //   verbose: configuration.verbose
  // };

  const userProfileOnlyFlag = (params.userProfileOnlyFlag !== undefined) ? params.userProfileOnlyFlag : configuration.userProfileOnlyFlag;
  const convertDatumFlag = (params.convertDatumFlag !== undefined) ? params.convertDatumFlag : false;
  const binaryMode = (params.binaryMode !== undefined) ? params.binaryMode : configuration.binaryMode;
  const verbose = configuration.verbose || params.verbose;
  const nnId = params.networkId || primaryNeuralNetworkId;

  if (!networksHashMap.has(nnId)){
    console.log(chalkError(MODULE_ID_PREFIX + " | NN NETWORK NOT IN HASHMAP" + nnId));
    throw new Error("NN NOT IN NETWORK HASHMAP: " + nnId);
  }

  const nnObj = networksHashMap.get(nnId);
  nnObj.meta.binaryMode = binaryMode;
  nnObj.meta.userProfileOnlyFlag = userProfileOnlyFlag;

  if (!nnObj.network || (nnObj.network === undefined)){
    console.log(chalkError(MODULE_ID_PREFIX + " | *** NN NETWORK UNDEFINED: " + nnId));
    await deleteNetwork(nnId);
    throw new Error("NN NETWORK UNDEFINED: " + nnId);
  }

  if (!nnObj.networkRawFlag || (nnObj.networkRawFlag === undefined) || 
    ((nnObj.network.activate === undefined) && (nnObj.network.run === undefined))
  ){

    console.log(chalkAlert(MODULE_ID_PREFIX + " | NN NETWORK ACTIVATE/RUN UNDEFINED"
      + " | TECH: " + nnObj.networkTechnology 
      + " | ID: " + nnObj.networkId 
      + " | INPUTS: " + nnObj.inputsId 
      + " | NN RAW FLAG: " + nnObj.networkRawFlag 
    ));

    networksHashMap.delete(nnId);

    throw new Error("ACTIVATE_UNDEFINED: " + nnObj.networkId);

  }

  let convertedDatum = {};

  if (convertDatumFlag) {
    convertedDatum = await tcUtils.convertDatum({
      user: params.user, 
      inputsId: nnObj.inputsId,
      userProfileOnlyFlag: userProfileOnlyFlag,
      binaryMode: binaryMode, 
      verbose: verbose
    });

    if (!convertedDatum || convertedDatum === undefined) {
      console.log(MODULE_ID_PREFIX + " | *** CONVERT DATUM ERROR | NO RESULTS");
      throw new Error("CONVERT DATUM ERROR | NO RESULTS")
    }
  }
  else {
    convertedDatum.inputsId = nnObj.inputsId;
    convertedDatum.inputHits = params.datum.inputHits;
    convertedDatum.inputMisses = params.datum.inputMisses;
    convertedDatum.inputHitRate = params.datum.inputHitRate;
    convertedDatum.datum = {};
    convertedDatum.datum = params.datum;
  }

  if (verbose) {
    console.log(chalkLog(MODULE_ID_PREFIX + " | CONVERT DATUM"
      + " | @" + convertedDatum.datum.screenName
      + " | INPUTS ID: " + convertedDatum.inputsId
      + " | H/M/TOT: " + convertedDatum.inputHits + "/" + convertedDatum.inputMisses + "/" + nnObj.numInputs
      + " | INPUT HIT RATE: " + convertedDatum.inputHitRate.toFixed(3) + "%"
    ));
  }

  let outputRaw = [];
  
  if (nnObj.networkTechnology === "brain"){
    const outputRawBrain = nnObj.network.run(convertedDatum.datum.input);
    // if (typeof outputRawBrain === "object"){
      outputRaw[0] = outputRawBrain["0"];
      outputRaw[1] = outputRawBrain["1"];
      outputRaw[2] = outputRawBrain["2"];
    // }
  }
  else{
    outputRaw = nnObj.network.activate(convertedDatum.datum.input);
  }
  // const outputRaw = nnObj.network.noTraceActivate(convertedDatum.datum.input);

  const networkOutput = {};
  networkOutput.nnId = nnId;
  networkOutput.user = {};
  networkOutput.user.nodeId = params.user.nodeId;
  networkOutput.user.screenName = params.user.screenName;
  networkOutput.user.category = params.user.category;
  networkOutput.user.categoryAuto = params.user.categoryAuto;
  networkOutput.binaryMode = binaryMode;
  networkOutput.userProfileOnlyFlag = userProfileOnlyFlag;
  networkOutput.outputRaw = [];
  networkOutput.outputRaw = outputRaw;
  networkOutput.output = [];
  networkOutput.output = [0,0,0];
  networkOutput.categoryAuto = "none";
  networkOutput.matchFlag = "MISS";
  networkOutput.inputHits = convertedDatum.inputHits;
  networkOutput.inputMisses = convertedDatum.inputMisses;
  networkOutput.inputHitRate = convertedDatum.inputHitRate;

  if (outputRaw.length !== 3) {
    console.log(chalkError(MODULE_ID_PREFIX + " | *** NETWORK OUTPUT SIZE !== 3  | " + nnId + " | outputRaw: " + outputRaw));
    return networkOutput;
  }


  const maxOutputIndex = await indexOfMax(outputRaw);

  switch (maxOutputIndex) {
    case 0:
      networkOutput.categoryAuto = "left";
      networkOutput.output = [1,0,0];
    break;
    case 1:
      networkOutput.categoryAuto = "neutral";
      networkOutput.output = [0,1,0];
    break;
    case 2:
      networkOutput.categoryAuto = "right";
      networkOutput.output = [0,0,1];
    break;
    default:
      networkOutput.categoryAuto = "none";
      networkOutput.output = [0,0,0];
  }

  networkOutput.matchFlag = ((params.user.category !== "none") && (networkOutput.categoryAuto === params.user.category)) ? "MATCH" : "MISS";

  const title = nnObj.networkId
      + " | BINARY MODE: " + nnObj.meta.binaryMode 
      + " | USER PROFILE ONLY: " + nnObj.meta.userProfileOnlyFlag 
      + " | INPUT: " + nnObj.inputsId 
      + " | INPUT H/M/RATE: " + networkOutput.inputHits + "/" + networkOutput.inputMisses + "/" + networkOutput.inputHitRate.toFixed(3)
      + " | @" + params.user.screenName 
      + " | C: " + formatCategory(params.user.category) 
      + " | A: " + formatCategory(networkOutput.categoryAuto)
      + " | MATCH: " + networkOutput.matchFlag;

  if (verbose) {
    await printNetworkInput({
      title: title,
      datum: convertedDatum.datum
    });
  }

  return networkOutput;
};

const activateSingleNetwork = NeuralNetworkTools.prototype.activateSingleNetwork;

NeuralNetworkTools.prototype.activate = async function (params) {

  if (networksHashMap.size === 0) {
    console.log(chalkError(MODULE_ID_PREFIX + " | *** NO NETWORKS IN HASHMAP"));
    throw new Error(MODULE_ID_PREFIX + " | *** NO NETWORKS IN HASHMAP");
  }

  const userProfileOnlyFlag = (params.userProfileOnlyFlag !== undefined) ? params.userProfileOnlyFlag : configuration.userProfileOnlyFlag;
  const binaryMode = (params.binaryMode !== undefined) ? params.binaryMode : configuration.binaryMode;
  const convertDatumFlag = (params.convertDatumFlag !== undefined) ? params.convertDatumFlag : false;
  const verbose = params.verbose || false;
  const user = params.user;
  const datum = params.datum;

  if (!user.profileHistograms || (user.profileHistograms === undefined)) {
    console.log(chalkWarn(MODULE_ID_PREFIX + " | UNDEFINED USER PROFILE HISTOGRAMS | @" + user.screenName));
    user.profileHistograms = {};
  }

  if (!user.tweetHistograms || (user.tweetHistograms === undefined)) {
    console.log(chalkWarn(MODULE_ID_PREFIX + " | UNDEFINED USER TWEET HISTOGRAMS | @" + user.screenName + "\n" + jsonPrint(params)));
    user.tweetHistograms = {};
  }

  if (!user.friends || (user.friends === undefined)) {
    console.log(chalkWarn(MODULE_ID_PREFIX + " | UNDEFINED USER FRIENDS | @" + user.screenName));
    user.friends = [];
  }

  const networkOutput = {};
  const nnIdArray = networksHashMap.keys();
  let currentNetworkId;

  try{

    for(const nnId of nnIdArray){

      currentNetworkId = nnId;

      if (!networksHashMap.has(nnId)){
        throw new Error(MODULE_ID_PREFIX + " | NET NOT IN HASHMAP | NN ID: " + nnId);
      }

      networkOutput[nnId] = {};

      networkOutput[nnId] = await activateSingleNetwork({
        networkId: nnId, 
        user: user, 
        datum: datum, 
        binaryMode: binaryMode,
        userProfileOnlyFlag: userProfileOnlyFlag,
        convertDatumFlag: convertDatumFlag, 
        verbose: verbose
      });

    }
  }
  catch(err){
    console.log(chalkError(MODULE_ID_PREFIX + " | activate | *** ACTIVATE NETWORK ERROR"
      + " | NNID: " + currentNetworkId
      + " | " + err
    ));
    throw err;
  }


  return {user: user, networkOutput: networkOutput};
};

module.exports = NeuralNetworkTools;
