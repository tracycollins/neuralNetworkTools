const MODULE_ID_PREFIX = "NNT";
const DEFAULT_BINARY_MODE = false;
// const DEFAULT_LOGSCALE_MODE = false;
const DEFAULT_USER_PROFILE_ONLY_FLAG = false;
const tcuChildName = MODULE_ID_PREFIX + "_TCU";

const DEFAULT_BRAIN_TRAIN_ERROR = 0.3;
const DEFAULT_BRAIN_TRAIN_ITERATIONS = 1000;
const DEFAULT_BRAIN_TRAIN_LEARNING_RATE = 0.3;
const DEFAULT_BRAIN_TRAIN_MOMENTUM = 0.1;

const debug = require("debug")(MODULE_ID_PREFIX);

const os = require("os");

let hostname = os.hostname();

hostname = hostname.replace(/\.example\.com/g, "");
hostname = hostname.replace(/\.local/g, "");
hostname = hostname.replace(/\.home/g, "");
hostname = hostname.replace(/\.at\.net/g, "");
hostname = hostname.replace(/\.fios-router\.home/g, "");
hostname = hostname.replace(/word0-instance-1/g, "google");
hostname = hostname.replace(/word-1/g, "google");
hostname = hostname.replace(/word/g, "google");

const carrot = require("@liquid-carrot/carrot");
const neataptic = require("neataptic");
const brain = require("brain.js");

const deepcopy = require("deepcopy");
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
// configuration.logScaleMode = DEFAULT_LOGSCALE_MODE;
configuration.verbose = false;

const statsObj = {};
statsObj.networks = {};
statsObj.bestNetwork = {};
statsObj.currentBestNetwork = {};

let DROPBOX_ROOT_FOLDER;

if (hostname.startsWith("google")){
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
};

NeuralNetworkTools.prototype.setBinaryMode = function(b){
  if (b === undefined) { return configuration.binaryMode; }
  configuration.binaryMode = b;
  tcUtils.setBinaryMode(b);
  console.log(chalkAlert(MODULE_ID_PREFIX + " | --> SET BINARY MODE: " + configuration.binaryMode));
  return;
};

NeuralNetworkTools.prototype.getBinaryMode = function(){
  return configuration.binaryMode;
};

// NeuralNetworkTools.prototype.setLogScaleMode = function(s){
//   if (s === undefined) { return configuration.logScaleMode; }
//   configuration.logScaleMode = s;
//   tcUtils.setLogScaleMode(s);
//   console.log(chalkAlert(MODULE_ID_PREFIX + " | --> SET LOG SCALE MODE: " + configuration.logScaleMode));
//   return;
// };

// NeuralNetworkTools.prototype.getLogScaleMode = function(){
//   return configuration.logScaleMode;
// };

NeuralNetworkTools.prototype.setUserProfileOnlyFlag = function(f){
  if (f === undefined) { return configuration.userProfileOnlyFlag; }
  configuration.userProfileOnlyFlag = f;
  tcUtils.setUserProfileOnlyFlag(f);
  console.log(chalkAlert(MODULE_ID_PREFIX + " | --> SET USER PROFILE ONLY FLAG: " + configuration.userProfileOnlyFlag));
  return;
};

NeuralNetworkTools.prototype.getUserProfileOnlyFlag = function(){
  return configuration.userProfileOnlyFlag;
};

// NeuralNetworkTools.prototype.setMaxInputHashMap = function(m){
//   return new Promise(function(resolve){
//     tcUtils.setMaxInputHashMap(m);
//     console.log(chalkLog(MODULE_ID_PREFIX + " | --> SET MAX INPUT HASHMAP: " + Object.keys(tcUtils.getMaxInputHashMap())));
//     resolve();
//   });
// };

// NeuralNetworkTools.prototype.getMaxInputHashMap = function(){
//   return tcUtils.getMaxInputHashMap();
// };

NeuralNetworkTools.prototype.setNormalization = function(n){
  return new Promise(function(resolve){
    tcUtils.setNormalization(n);
    console.log(chalkLog(MODULE_ID_PREFIX + " | --> SET NORMALIZATION\n" + jsonPrint(tcUtils.getNormalization())));
    resolve();
  });
};

NeuralNetworkTools.prototype.getNormalization = function(){
  const normalization = tcUtils.getNormalization();
  return normalization;
};

NeuralNetworkTools.prototype.getNumberNetworks = function(){
  const numNetworks = networksHashMap.size;
  return numNetworks;
};

const networkDefaults = {};

networkDefaults.binaryMode = configuration.binaryMode;
// networkDefaults.userProfileOnlyFlag = configuration.userProfileOnlyFlag;
// networkDefaults.logScaleMode = configuration.logScaleMode;
networkDefaults.rank = Infinity;
networkDefaults.previousRank = Infinity;
networkDefaults.matchRate = 0;
networkDefaults.runtimeMatchRate = 0;
networkDefaults.overallMatchRate = 0;
networkDefaults.successRate = 0;
networkDefaults.testCycles = 0;
networkDefaults.testCycleHistory = [];

networkDefaults.meta = {};

networkDefaults.meta.category = "none";
networkDefaults.meta.categoryAuto = "none";
networkDefaults.meta.binaryMode = configuration.binaryMode;
// networkDefaults.meta.logScaleMode = configuration.logScaleMode;
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
  "binaryMode",
  // "logScaleMode",
  "inputsId",
  "matchFlag",
  "matchRate",
  "meta",
  "networkId",
  "networkTechnology",
  "numInputs",
  "numOutputs",
  "output",
  "overallMatchRate",
  "previousRank",
  "rank",
  "runtimeMatchRate",
  "seedNetworkId",
  "seedNetworkRes",
  "successRate",
  "testCycleHistory",
  "testCycles"
];

NeuralNetworkTools.prototype.loadInputs = async function(params){
  await tcUtils.loadInputs({inputsObj: params.inputsObj});
  return;
};

NeuralNetworkTools.prototype.loadNetwork = async function(params){

  if (empty(params.networkObj)) {
    console.log(chalkError(MODULE_ID_PREFIX + " | *** LOAD NN UNDEFINED: " + params.networkObj));
    throw new Error(MODULE_ID_PREFIX + " | LOAD NN UNDEFINED");
  }

  if (empty(params.networkObj.network) && empty(params.networkObj.networkJson)) {
    console.log(chalkError(MODULE_ID_PREFIX + " | *** LOAD NN JSON UNDEFINED: " + params.networkObj.networkId));
    throw new Error(MODULE_ID_PREFIX + " | LOAD NN JSON UNDEFINED");
  }

  if (!params.networkObj.inputsId || params.networkObj.inputsId === undefined) {
    console.log(chalkError(MODULE_ID_PREFIX + " | *** LOAD NN INPUTS ID UNDEFINED: " + params.networkObj.networkId));
    throw new Error(MODULE_ID_PREFIX + " | LOAD NN INPUTS ID UNDEFINED");
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

    if (params.isBestNetwork || (statsObj.bestNetwork.runtimeMatchRate < nn.runtimeMatchRate)) {
      printNetworkObj(MODULE_ID_PREFIX + " | --> LOAD BEST RUNTIME NN", nn, chalk.green);
      statsObj.bestNetwork = pick(nn, networkPickArray);
    }

    if (statsObj.currentBestNetwork.runtimeMatchRate < nn.runtimeMatchRate){
      printNetworkObj(MODULE_ID_PREFIX + " | --> LOAD CURRENT BEST RUNTIME NN", nn, chalk.green);
      statsObj.currentBestNetwork = pick(nn, networkPickArray);
    }

    let network;

    if (nn.networkTechnology === "brain"){
      console.log(chalkWarn(MODULE_ID_PREFIX + " | ... LOAD NN RAW | TECH: " + nn.networkTechnology + " | " + nn.networkId));

      if (params.networkIsRaw) {
        console.log(chalkWarn(MODULE_ID_PREFIX + " | ... LOAD NN RAW | TECH: " + nn.networkTechnology + " | " + nn.networkId));
        network = nn.network;
      }
      else{
        console.log(chalkWarn(MODULE_ID_PREFIX + " | ... CONVERT+LOAD NN FROM JSON | TECH: " + nn.networkTechnology + " | " + nn.networkId));

        if (!empty(nn.networkJson)) {
          network = new brain.NeuralNetwork();
          network.fromJSON(nn.networkJson);
        }
        else if (!empty(nn.network)) {
          network = new brain.NeuralNetwork();
          network.fromJSON(nn.network);
        }
        else{ 
          console.log(chalkError(MODULE_ID_PREFIX + " | *** LOAD NN FROM JSON ERROR | NO JSON??? | TECH: " + nn.networkTechnology + " | " + nn.networkId));
        }
      }
    }
    else if (nn.networkTechnology === "carrot"){
      console.log(chalkWarn(MODULE_ID_PREFIX + " | ... LOAD NN RAW | TECH: " + nn.networkTechnology + " | " + nn.networkId));

      if (params.networkIsRaw) {
        console.log(chalkWarn(MODULE_ID_PREFIX + " | ... LOAD NN RAW | TECH: " + nn.networkTechnology + " | " + nn.networkId));
        network = nn.network;
      }
      else{
        console.log(chalkWarn(MODULE_ID_PREFIX + " | ... CONVERT+LOAD NN FROM JSON | TECH: " + nn.networkTechnology + " | " + nn.networkId));

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
          console.log(chalkError(MODULE_ID_PREFIX + " | *** LOAD NN FROM JSON ERROR | NO JSON??? | TECH: " + nn.networkTechnology + " | " + nn.networkId));
        }
      }
    }
    else if (nn.networkTechnology === "neataptic"){
      if (params.networkIsRaw) {
        console.log(chalkWarn(MODULE_ID_PREFIX + " | ... LOAD NN RAW | TECH: " + nn.networkTechnology + " | " + nn.networkId));
        network = nn.network;
      }
      else{
        console.log(chalkWarn(MODULE_ID_PREFIX + " | ... CONVERT+LOAD NN FROM JSON | TECH: " + nn.networkTechnology + " | " + nn.networkId));

        if (!empty(nn.networkJson)) {
          network = neataptic.Network.fromJSON(nn.networkJson);
        }
        else if (!empty(nn.network)) {
          network = neataptic.Network.fromJSON(nn.network);
        }
        else{
          console.log(chalkError(MODULE_ID_PREFIX + " | *** LOAD NN FROM JSON ERROR | NO JSON??? | TECH: " + nn.networkTechnology + " | " + nn.networkId));
        }
      }
    }
    else {
      nn.networkTechnology = "neataptic";
      console.log(chalkAlert(MODULE_ID_PREFIX + " | ??? TRY CONVERT+LOAD NN FROM JSON | ??? TECH: " + nn.networkTechnology + " | " + nn.networkId));
      try{
        network = neataptic.Network.fromJSON(nn.network);
      }
      catch(err){
        console.log(chalkAlert(MODULE_ID_PREFIX + " | ??? TRY LOAD NN FROM JSON | ??? TECH: " + nn.networkTechnology + " | " + nn.networkId));
        network = nn.network;
      }
    }

    nn.network = {};
    nn.network = network;
    nn.networkRawFlag = true;

    try{

      let inputsObj = nn.inputsObj;

      if (empty(inputsObj)){

        inputsObj = await global.wordAssoDb.NetworkInputs.findOne({inputsId: nn.inputsId}).lean();

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

      console.log(chalkLog(MODULE_ID_PREFIX + " | --> LOAD NN: " + nn.networkId 
        + " | BIN: " + formatBoolean(nn.binaryMode) 
        // + " | LOG SCALE: " + formatBoolean(nn.logScaleMode) 
        + " | " + networksHashMap.size + " NNs"
      ));
      
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
};

NeuralNetworkTools.prototype.deleteAllNetworks = async function(){

  try{

    console.log(chalkError(MODULE_ID_PREFIX + " | XXX DEL ALL NETWORKS"));

    networksHashMap.clear();

    statsObj.networks = {};
    primaryNeuralNetworkId = false;
    statsObj.bestNetwork = {};
    statsObj.currentBestNetwork = {};

    return;

  }
  catch(err){
    console.log(chalkError(MODULE_ID_PREFIX + " | *** DEL ALL NN ERROR"
      + " | " + err
    ));
    throw err;
  }
};

NeuralNetworkTools.prototype.deleteNetwork = async function(params){

  if (!params.networkId) {
    console.log(chalkError(MODULE_ID_PREFIX + " | *** DEL NN ID UNDEFINED: " + params.networkId));
    throw new Error(MODULE_ID_PREFIX + " | DEL NN ID UNDEFINED");
  }

  try{

    console.log(chalkError(MODULE_ID_PREFIX + " | XXX DEL NN: " + params.networkId));

    networksHashMap.delete(params.networkId);

    delete statsObj.networks[params.networkId];

    if (primaryNeuralNetworkId == params.networkId){
      console.log(chalkError(MODULE_ID_PREFIX + " | XXX DEL PRIMARY NN: " + params.networkId));
      primaryNeuralNetworkId = false;
    }

    if (statsObj.bestNetwork && (statsObj.bestNetwork !== undefined) && (statsObj.bestNetwork.networkId == params.networkId)){
      console.log(chalkError(MODULE_ID_PREFIX + " | XXX DEL BEST NN: " + params.networkId));
      delete statsObj.bestNetwork;
    }

    if (statsObj.currentBestNetwork && (statsObj.currentBestNetwork !== undefined) && (statsObj.currentBestNetwork.networkId == params.networkId)){
      console.log(chalkError(MODULE_ID_PREFIX + " | XXX DEL CURRENT BEST NN: " + params.networkId));
      delete statsObj.currentBestNetwork;
    }

    return;

  }
  catch(err){
    console.log(chalkError(MODULE_ID_PREFIX + " | *** DEL NN ERROR"
      + " | NN ID: " + params.networkId
      + " | " + err
    ));
    throw err;
  }
};

const deleteNetwork = NeuralNetworkTools.prototype.deleteNetwork;

NeuralNetworkTools.prototype.setPrimaryInputs = async function(inputsId){
  await tcUtils.setPrimaryInputs({inputsId: inputsId});
};

NeuralNetworkTools.prototype.setPrimaryNeuralNetwork = async function(nnId){

  if (!nnId || nnId === undefined) {
    console.log(chalkError(MODULE_ID_PREFIX + " | *** PRIMARY NN ID UNDEFINED: " + nnId));
    return new Error(MODULE_ID_PREFIX + " | PRIMARY NN ID UNDEFINED");
  }

  if (!networksHashMap.has(nnId)){
    console.log(chalkError(MODULE_ID_PREFIX + " | *** PRIMARY NN NOT LOADED: " + nnId));
    return new Error(MODULE_ID_PREFIX + " | PRIMARY NN NOT LOADED: " + nnId);
  }

  primaryNeuralNetworkId = nnId;
  const nnObj = networksHashMap.get(primaryNeuralNetworkId);

  if (!inputsHashMap.has(nnObj.inputsId)){
    console.log(chalkError(MODULE_ID_PREFIX + " | *** setPrimaryNeuralNetwork PRIMARY NN INPUTS NOT IN HASHMAP: " + nnObj.inputsId));
    return new Error(MODULE_ID_PREFIX + " | PRIMARY NN INPUTS NOT IN HASHMAP: " + nnObj.inputsId);
  }

  await tcUtils.setPrimaryInputs({inputsId: nnObj.inputsId});

  console.log(chalkLog(MODULE_ID_PREFIX + " | --> SET PRIMARY NN: " + primaryNeuralNetworkId));

  return primaryNeuralNetworkId;
};

NeuralNetworkTools.prototype.getPrimaryNeuralNetwork = function(){
  return primaryNeuralNetworkId;
};

let previousPrintedNetworkObj = {};

function outputNetworkInputText(params){
  if (params.truncated){
    console.log(chalkLog(
      params.hits + "/" + params.inputArraySize + " | HIT RATE: " + params.hitRate.toFixed(2) + "% | " + params.title
    ));
    return;
  }
  console.log(chalkLog(
    "______________________________________________________________________________________________________________________________________"
    + "\n" + params.hits + "/" + params.inputArraySize + " | HIT RATE: " + params.hitRate.toFixed(2) + "%"
    + "\n" + params.title
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
};

let titleDefault;

NeuralNetworkTools.prototype.printNetworkResults = function(p){

  const statsTextArray = [];

  return new Promise(function(resolve, reject){

    const params = p || {};

    statsObj.currentBestNetwork = defaults(statsObj.currentBestNetwork, networkDefaults);

    titleDefault = "T: " + statsObj.currentBestNetwork.networkTechnology.charAt(0).toUpperCase()
      + " | B: " + formatBoolean(statsObj.currentBestNetwork.binaryMode)
      // + " | LSM: " + formatBoolean(statsObj.currentBestNetwork.logScaleMode)
      + " | PF ONLY: " + formatBoolean(statsObj.currentBestNetwork.meta.userProfileOnlyFlag)
      + " - CFG: " + formatBoolean(configuration.userProfileOnlyFlag)
      + " | RK: " + statsObj.currentBestNetwork.rank
      + " PRK: " + statsObj.currentBestNetwork.previousRank
      + " | " + statsObj.currentBestNetwork.networkId
      + " | " + statsObj.currentBestNetwork.inputsId
      + " | " + statsObj.currentBestNetwork.meta.match + "/" + statsObj.currentBestNetwork.meta.total
      + " | MR: " + statsObj.currentBestNetwork.matchRate.toFixed(2) + "%"
      + " | RMR: " + statsObj.currentBestNetwork.runtimeMatchRate.toFixed(2) + "%"
      // + " | OUT: " + statsObj.currentBestNetwork.meta.output
      + " | CM: " + formatCategory(statsObj.currentBestNetwork.meta.category)
      + " A: " + formatCategory(statsObj.currentBestNetwork.meta.categoryAuto)
      + " | MTCH: " + formatBoolean(statsObj.currentBestNetwork.meta.matchFlag);

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
        nn.runtimeMatchRate.toFixed(2),
        nn.overallMatchRate.toFixed(2),
        nn.successRate.toFixed(2),
        nn.testCycles,
        nn.testCycleHistory.length,
        nn.meta.matchFlag,
        formatBoolean(nn.binaryMode),
        // formatBoolean(nn.logScaleMode),
        formatBoolean(nn.meta.userProfileOnlyFlag),
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
        "RMR",
        "OAMR",
        "SR",
        "TCs",
        "TCH",
        "MFLAG",
        "BIN",
        // "LSM",
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
        + table(statsTextArray, { align: ["l", "r", "r", "l", "l", "l", "r", "r", "r", "r", "r", "r", "l", "l", "l", "r", "r", "r", "r", "r"] })
        + "\nNNT | -------------------------------------------------------------------------------------------------------------------------------------------------"
      ));

      resolve(statsTextArray);

    });

  });
};

const printNetworkInput = NeuralNetworkTools.prototype.printNetworkInput;

NeuralNetworkTools.prototype.printNetworkObj = function(title, nn, format) {

  const chalkFormat = (format !== undefined) ? format : chalk.blue;
  const rank = (nn.rank !== undefined) ? nn.rank : Infinity;
  const previousRank = (nn.previousRank !== undefined) ? nn.previousRank : Infinity;
  const overallMatchRate = nn.overallMatchRate || 0;
  const runtimeMatchRate = nn.runtimeMatchRate || 0;
  const matchRate = nn.matchRate || 0;
  const successRate = nn.successRate || 0;
  const testCycleHistory = nn.testCycleHistory || [];

  console.log(chalkFormat(title
    + " | BIN: " + formatBoolean(nn.binaryMode)
    + " | RK: " + rank
    + " | PREV RK: " + previousRank
    + " | OAMR: " + overallMatchRate.toFixed(2) + "%"
    + " | RMR: " + runtimeMatchRate.toFixed(2) + "%"
    + " | MR: " + matchRate.toFixed(2) + "%"
    + " | SR: " + successRate.toFixed(2) + "%"
    + " | CR: " + tcUtils.getTimeStamp(nn.createdAt)
    + " | TC:  " + nn.testCycles
    + " | TH: " + testCycleHistory.length
    + " |  " + nn.inputsId
    + " | " + nn.networkId
  ));

  return;
};

const printNetworkObj = NeuralNetworkTools.prototype.printNetworkObj;

NeuralNetworkTools.prototype.getNetworkStats = function (){
  return new Promise(function(resolve){
    resolve(statsObj);
  });
};

NeuralNetworkTools.prototype.updateNetworkRank = function (p){

  return new Promise(function(resolve, reject){

    const params = p || {};

    const sortByMetric = params.sortByMetric || "matchRate";

    const sortedNetworksArray = _.sortBy(networksHashMap.values(), [sortByMetric]);
    _.reverse(sortedNetworksArray);

    async.eachOfSeries(sortedNetworksArray, function(nn, index, cb){

      // nn.previousRank = nn.rank;
      statsObj.networks[nn.networkId].previousRank = nn.previousRank;

      nn.rank = index;
      statsObj.networks[nn.networkId].rank = index;

      networksHashMap.set(nn.networkId, nn);

      if (index === 0){
        if ((statsObj.currentBestNetwork.networkId !== nn.networkId) 
          && (statsObj.currentBestNetwork.matchRate < nn.matchRate)
        ) {
          printNetworkObj(MODULE_ID_PREFIX + " | +++ NEW CURRENT BEST NN    | " + nn.meta.match + "/" + nn.meta.total, nn, chalk.green);
        }
        statsObj.currentBestNetwork = pick(nn, networkPickArray);
      }

      cb();

    }, function(err){

      if (err) {
        return reject(err);
      }

      resolve(statsObj.currentBestNetwork);
    });
  });
};

const updateNetworkRank = NeuralNetworkTools.prototype.updateNetworkRank;

NeuralNetworkTools.prototype.updateNetworkStats = function (params){

  return new Promise(function(resolve, reject){

    if (!params.networkOutput || params.networkOutput === undefined) {
      return reject(new Error("params networkOutput undefined"));
    }

    const primaryNetwork = params.primaryNetwork || false; // 
    const verbose = params.verbose || false; //
    const sortByMetric = params.sortBy || "matchRate";

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

    let nn;
    let tempNetwork;

    async.eachSeries(nnIdArray, function(nnId, cb){

      nn = networksHashMap.get(nnId);

      if (!statsObj.networks[nnId] || statsObj.networks[nnId] === undefined || statsObj.networks[nnId] === {}) {
        statsObj.networks[nnId] = {};
        statsObj.networks[nnId] = networkDefaults;
      }

      tempNetwork = statsObj.networks[nnId];

      if (!nn || nn === undefined) {
        return reject(new Error(MODULE_ID_PREFIX + " | updateNetworkStats NN UNDEFINED | NN ID: " + nnId));
      }

      nn = defaults(nn, networkDefaults);
      nn.meta = defaults(nn.meta, networkDefaults.meta);

      tempNetwork = pick(nn, networkPickArray);
      tempNetwork.meta = nn.meta;
      tempNetwork.meta.matchFlag = false;

      tempNetwork.meta.output = [];
      tempNetwork.meta.output = networkOutput[nnId].output;

      if(!user.category || user.category === undefined || user.category === "false" || user.category === "none"){
        user.category = "none";
        tempNetwork.meta.none += 1;
      }
      else{

        tempNetwork.meta[user.category] += 1;
        tempNetwork.meta.total += 1;

        if (user.category === networkOutput[nnId].categoryAuto) {
          tempNetwork.meta.match += 1;
          tempNetwork.meta.matchFlag = "MATCH";
          chalkCategory = chalk.green;
        }
        else {
          tempNetwork.meta.mismatch += 1;
          tempNetwork.meta.matchFlag = "MISS";
          chalkCategory = chalk.gray;
        }
      }

      networkOutput[nnId].category = user.category;
      
      tempNetwork.meta.category = user.category;
      tempNetwork.meta.categoryAuto = networkOutput[nnId].categoryAuto;

      if (verbose){
        console.log(chalkCategory(MODULE_ID_PREFIX + " | " + tempNetwork.meta.matchFlag
          + " | @" + user.screenName
          + " | CM: " + formatCategory(user.category) + " | CA: " + formatCategory(tempNetwork.meta.categoryAuto)
          + " | " + tempNetwork.networkId
          + " | " + tempNetwork.inputsId
          + " | SR: " + tempNetwork.successRate.toFixed(2) 
          + " | OAMR: " + tempNetwork.overallMatchRate.toFixed(2) 
          + " | RMR: " + tempNetwork.runtimeMatchRate.toFixed(2) 
          + " | MR: " + tempNetwork.matchRate.toFixed(2) 
        ));
      }

      if (tempNetwork.meta.total === 0) {
        tempNetwork.matchRate = 0;
      }
      else {
        tempNetwork.matchRate = 100.0 * tempNetwork.meta.match / tempNetwork.meta.total;
      }

      if (params.updateRuntimeMatchRate) { 
        tempNetwork.runtimeMatchRate = tempNetwork.matchRate; 
      }

      nn.rank = tempNetwork.rank;
      nn.previousRank = tempNetwork.previousRank;
      nn.matchRate = tempNetwork.matchRate;
      nn.runtimeMatchRate = tempNetwork.runtimeMatchRate;
      nn.overallMatchRate = tempNetwork.overallMatchRate;
      nn.testCycleHistory = tempNetwork.testCycleHistory;
      nn.testCycles = tempNetwork.testCycles;
      nn.output = tempNetwork.meta.output;
      nn.meta = tempNetwork.meta;

      networksHashMap.set(nnId, nn);

      statsObj.networks[nnId] = tempNetwork;

      cb();

    }, function(err2){

      if (err2) {
        return reject(err2);
      }

        updateNetworkRank({sortByMetric: sortByMetric})
        .then(function(){
          resolve(statsObj.currentBestNetwork);
        })
        .catch(function(err1){
          return reject(err1);
        });
    });
  });
};

NeuralNetworkTools.prototype.convertNetwork = function(params){

  return new Promise(function(resolve, reject){

    const nnObj = params.networkObj;

    if (empty(nnObj.network) && empty(nnObj.networkJson)) {
      console.log(chalkError(MODULE_ID_PREFIX + " | *** NO OLD NET or JSON EXIST | TECH: " + nnObj.networkTechnology + " | " + nnObj.networkId));
      reject(new Error("NO JSON NN"));
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
          nnObj.networkRaw = new brain.NeuralNetwork();
          nnObj.networkRaw.fromJSON(nnObj.networkJson);
        }
        else if (!empty(nnObj.network)) {
          nnObj.networkRaw = new brain.NeuralNetwork();
          nnObj.networkRaw.fromJSON(nnObj.network);
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
      // const newNetObj = objectRenameKeys(nnObj, {network: "networkJson"});

      nnObj.networkJson = {};
      nnObj.networkJson = deepcopy(nnObj.network);
      nnObj.network = {};

      if (nnObj.networkTechnology === "carrot") {
        nnObj.networkRaw = carrot.Network.fromJSON(nnObj.networkJson);
      }
      else if (nnObj.networkTechnology === "brain") {
        nnObj.networkRaw = brain.NeuralNetwork.fromJSON(nnObj.networkJson);
      }
      else {
        nnObj.networkRaw = neataptic.Network.fromJSON(nnObj.networkJson);
      }

      resolve(nnObj);
    }
    else{
      console.log(chalkError(MODULE_ID_PREFIX + " | *** convertNetwork ERROR: NO VALID NN JSON " + nnObj.networkId));
      reject(new Error("NO VALID JSON NN: " + nnObj.networkId));
    }

  });
};

NeuralNetworkTools.prototype.streamTrainNetwork = async function (params) {

  return new Promise(function(resolve){

    const network = params.network;
    const trainingSet = params.trainingSet;

    const DEFAULT_BRAIN_TRAIN_SCHEDULE = function(data){
      console.log(MODULE_ID_PREFIX +" streamTrainNetwork | ", data);
    };

    // BRAIN
    // net.train(data, {
    //   // Defaults values --> expected validation
    //   iterations: 20000, // the maximum times to iterate the training data --> number greater than 0
    //   errorThresh: 0.005, // the acceptable error percentage from training data --> number between 0 and 1
    //   log: false, // true to use console.log, when a function is supplied it is used --> Either true or a function
    //   logPeriod: 10, // iterations between logging out --> number greater than 0
    //   learningRate: 0.3, // scales with delta to effect training rate --> number between 0 and 1
    //   momentum: 0.1, // scales with next layer's change value --> number between 0 and 1
    //   callback: null, // a periodic call back that can be triggered while training --> null or function
    //   callbackPeriod: 10, // the number of iterations through the training data between callback calls --> number greater than 0
    //   timeout: Infinity, // the max number of milliseconds to train for --> number greater than 0
    // })

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
};

NeuralNetworkTools.prototype.activateSingleNetwork = async function (params) {

  // const activateParams = {
  //   user: datum.user, 
  //   datum: datum, (user, input, output)
  //   convertDatumFlag: convertDatumFlag, 
  //   binaryMode: binaryMode, 
  //   verbose: configuration.verbose
  // };

  const userProfileOnlyFlag = (params.userProfileOnlyFlag !== undefined) ? params.userProfileOnlyFlag : configuration.userProfileOnlyFlag;
  const binaryMode = (params.binaryMode !== undefined) ? params.binaryMode : configuration.binaryMode;
  const convertDatumFlag = (params.convertDatumFlag !== undefined) ? params.convertDatumFlag : false;
  const verbose = configuration.verbose || params.verbose;
  const nnId = params.networkId || primaryNeuralNetworkId;

  if (!networksHashMap.has(nnId)){
    console.log(chalkError(MODULE_ID_PREFIX + " | NN NOT IN HASHMAP" + nnId));
    throw new Error("NN NOT IN HASHMAP: " + nnId);
  }

  const nnObj = networksHashMap.get(nnId);

  if (!nnObj.network || (nnObj.network === undefined)){
    console.log(chalkError(MODULE_ID_PREFIX + " | *** NN UNDEFINED: " + nnId));
    await deleteNetwork(nnId);
    throw new Error("NN UNDEFINED: " + nnId);
  }

  if (!nnObj.networkRawFlag || (nnObj.networkRawFlag === undefined) || 
    ((nnObj.network.activate === undefined) && (nnObj.network.run === undefined))
  ){

    console.log(chalkAlert(MODULE_ID_PREFIX + " | NN ACTIVATE/RUN UNDEFINED"
      + " | TECH: " + nnObj.networkTechnology 
      + " | ID: " + nnObj.networkId 
      + " | INPUTS: " + nnObj.inputsId 
      + " | NN RAW FLAG: " + nnObj.networkRawFlag 
    ));

    networksHashMap.delete(nnId);

    throw new Error("ACTIVATE_UNDEFINED: " + nnObj.networkId);

  }

  nnObj.binaryMode = nnObj.binaryMode || binaryMode;
  nnObj.meta.userProfileOnlyFlag = (nnObj.meta.userProfileOnlyFlag !== undefined)
    ? nnObj.meta.userProfileOnlyFlag : userProfileOnlyFlag;

  let convertedDatum = {};

  if (convertDatumFlag) {
    convertedDatum = await tcUtils.convertDatum({
      user: params.user, 
      inputsId: nnObj.inputsId,
      userProfileOnlyFlag: nnObj.meta.userProfileOnlyFlag,
      binaryMode: nnObj.binaryMode, 
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

  const allZero = convertedDatum.datum.input.every((value) => value === 0);

  if (allZero) {
    debug(chalkAlert(MODULE_ID_PREFIX + " | !!! ALL ZERO INPUT | activateSingleNetwork"
      + " | NN: " + nnObj.networkId
      + " | @" + convertedDatum.datum.screenName
      + " | INPUTS ID: " + convertedDatum.inputsId
      + " | H/M/TOT: " + convertedDatum.inputHits + "/" + convertedDatum.inputMisses + "/" + nnObj.numInputs
      + " | INPUT HIT RATE: " + convertedDatum.inputHitRate.toFixed(3) + "%"
    ));
  }
  
  if (nnObj.networkTechnology === "brain"){
    const outputRawBrain = nnObj.network.run(convertedDatum.datum.input);
    outputRaw[0] = outputRawBrain["0"];
    outputRaw[1] = outputRawBrain["1"];
    outputRaw[2] = outputRawBrain["2"];
  }
  else{
    outputRaw = nnObj.network.activate(convertedDatum.datum.input);
  }

  const networkOutput = {};
  networkOutput.nnId = nnId;
  networkOutput.networkId = nnId;
  networkOutput.user = {};
  networkOutput.user.nodeId = params.user.nodeId;
  networkOutput.user.screenName = params.user.screenName;
  networkOutput.user.category = (!params.user.category || params.user.category === "false" || params.user.category === undefined) ? "none" : params.user.category;
  networkOutput.user.categoryAuto = (!params.user.categoryAuto || params.user.categoryAuto === "false" || params.user.categoryAuto === undefined) ? "none" : params.user.categoryAuto;
  networkOutput.user.categorizeNetwork = params.user.categorizeNetwork;
  networkOutput.binaryMode = nnObj.binaryMode;
  // networkOutput.logScaleMode = nnObj.logScaleMode;
  networkOutput.userProfileOnlyFlag = userProfileOnlyFlag;
  networkOutput.outputRaw = [];
  networkOutput.outputRaw = outputRaw;
  networkOutput.output = [];
  networkOutput.output = [0,0,0];
  networkOutput.categoryAuto = (!params.user.categoryAuto || params.user.categoryAuto === "false" || params.user.categoryAuto === undefined) ? "none" : params.user.categoryAuto;
  networkOutput.matchFlag = "MISS";
  networkOutput.inputHits = convertedDatum.inputHits;
  networkOutput.inputMisses = convertedDatum.inputMisses;
  networkOutput.inputHitRate = convertedDatum.inputHitRate;

  if (outputRaw.length !== 3) {
    console.log(chalkError(MODULE_ID_PREFIX + " | *** NN OUTPUT SIZE !== 3  | " + nnId + " | outputRaw: " + outputRaw));
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

  if (verbose) {

    const title = nnObj.networkId
        + " | BIN: " + nnObj.binaryMode 
        // + " | LOG: " + nnObj.logScaleMode 
        + " | PROF ONLY: " + userProfileOnlyFlag 
        + " | INP: " + nnObj.inputsId 
        + " | H/M: " + networkOutput.inputHits + "/" + networkOutput.inputMisses
        + " | R: " + networkOutput.inputHitRate.toFixed(3) + "%"
        + " | @" + params.user.screenName 
        + " | C: " + formatCategory(params.user.category) 
        + " | A: " + formatCategory(networkOutput.categoryAuto)
        + " | MTCH: " + networkOutput.matchFlag;

    await printNetworkInput({
      title: title,
      datum: convertedDatum.datum
    });

    return networkOutput;
  }
  else{
    return networkOutput;
  }
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
    user.profileHistograms = {};
  }

  if (!user.tweetHistograms || (user.tweetHistograms === undefined)) {
    user.tweetHistograms = {};
  }

  if (!user.friends || (user.friends === undefined)) {
    user.friends = [];
  }

  const nnIdArray = networksHashMap.keys();
  let currentNetworkId;

  try{

    const promiseArray = [];
    const activateParams = {};

    activateParams.userProfileOnlyFlag = userProfileOnlyFlag;
    activateParams.binaryMode = binaryMode;
    activateParams.convertDatumFlag = convertDatumFlag;
    activateParams.verbose = verbose;
    activateParams.user = user;
    activateParams.datum = datum;

    for(const nnId of nnIdArray){

      currentNetworkId = nnId;

      if (!networksHashMap.has(nnId)){
        throw new Error(MODULE_ID_PREFIX + " | NET NOT IN HASHMAP | NN ID: " + nnId);
      }

      activateParams.networkId = nnId;
      promiseArray.push(activateSingleNetwork(activateParams));

      // networkOutput[nnId] = await activateSingleNetwork({
      //   networkId: nnId, 
      //   user: user, 
      //   datum: datum,
      //   binaryMode: binaryMode,
      //   userProfileOnlyFlag: userProfileOnlyFlag,
      //   convertDatumFlag: convertDatumFlag, 
      //   verbose: verbose
      // });

    }

    const resultsArray = await Promise.all(promiseArray); // results is array of networkOutputs

    const networkOutput = resultsArray.reduce((nnOutHashMap, nnOut) => {
      nnOutHashMap[nnOut.networkId] = nnOut;
      return nnOutHashMap;
    }, {});

    return {user: user, networkOutput: networkOutput};

  }
  catch(err){
    console.log(chalkError(MODULE_ID_PREFIX + " | activate | *** ACTIVATE NN ERROR"
      + " | NNID: " + currentNetworkId
      + " | " + err
    ));
    throw err;
  }
};

module.exports = NeuralNetworkTools;
