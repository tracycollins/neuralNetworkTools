/*jslint node: true */
/*jshint sub:true*/

const DEFAULT_BINARY_MODE = true;

const path = require("path");
const os = require("os");
let hostname = os.hostname();
hostname = hostname.replace(/\.example\.com/g, "");
hostname = hostname.replace(/\.local/g, "");
hostname = hostname.replace(/\.home/g, "");
hostname = hostname.replace(/\.at\.net/g, "");
hostname = hostname.replace(/\.fios-router\.home/g, "");
hostname = hostname.replace(/word0-instance-1/g, "google");
hostname = hostname.replace(/word/g, "google");

let DROPBOX_ROOT_FOLDER;

if (hostname == "google") {
  DROPBOX_ROOT_FOLDER = "/home/tc/Dropbox/Apps/wordAssociation";
}
else {
  DROPBOX_ROOT_FOLDER = "/Users/tc/Dropbox/Apps/wordAssociation";
}

const DEFAULT_CONFIG_FOLDER = path.join(DROPBOX_ROOT_FOLDER, "config/utility/default");

const neataptic = require("neataptic");
const async = require("async");
const util = require("util");
const _ = require("lodash");
const EventEmitter = require("events");
const HashMap = require("hashmap").HashMap;
const defaults = require("object.defaults");
const pick = require("object.pick");
const table = require("text-table");

const tcuChildName = "NNT_TCU";
const ThreeceeUtilities = require("@threeceelabs/threecee-utilities");
const tcUtils = new ThreeceeUtilities(tcuChildName);

const jsonPrint = tcUtils.jsonPrint;
const indexOfMax = tcUtils.indexOfMax;

const chalk = require("chalk");
const chalkWarn = chalk.yellow;
const chalkAlert = chalk.red;
const chalkError = chalk.bold.red;
const chalkLog = chalk.gray;

const networksHashMap = new HashMap();

let primaryNeuralNetworkId;

const configuration = {};
configuration.binaryMode = DEFAULT_BINARY_MODE;
configuration.verbose = false;
configuration.inputsFolder = path.join(DEFAULT_CONFIG_FOLDER, "inputs");

const statsObj = {};
statsObj.networks = {};
statsObj.bestNetwork = false;
statsObj.currentBestNetwork = false;

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
  console.log(chalkAlert("NNT | --> SET VERBOSE: " + configuration.verbose));
  return;
}

NeuralNetworkTools.prototype.setBinaryMode = function(b){
  if (b === undefined) { return configuration.binaryMode; }
  configuration.binaryMode = b;
  console.log(chalkAlert("NNT | --> SET BINARY MODE: " + configuration.binaryMode));
  return;
}

NeuralNetworkTools.prototype.getBinaryMode = function(){
  return configuration.binaryMode;
}

NeuralNetworkTools.prototype.setMaxInputHashMap = function(m){
  return new Promise(function(resolve){
    tcUtils.setMaxInputHashMap(m);
    console.log(chalkLog("NNT | --> SET MAX INPUT HASHMAP: " + Object.keys(tcUtils.getMaxInputHashMap())));
    resolve();
  });
}

NeuralNetworkTools.prototype.getMaxInputHashMap = function(){
  return tcUtils.getMaxInputHashMap();
}

NeuralNetworkTools.prototype.setNormalization = function(n){
  return new Promise(function(resolve){
    tcUtils.setNormalization(n);
    console.log(chalkLog("NNT | --> SET NORMALIZATION\n" + jsonPrint(tcUtils.getNormalization())));
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
networkDefaults.matchRate = 0;
networkDefaults.overallMatchRate = 0;
networkDefaults.successRate = 0;
networkDefaults.testCycles = 0;
networkDefaults.testCycleHistory = [];

networkDefaults.meta = {};

networkDefaults.meta.category = false;
networkDefaults.meta.categoryAuto = false;
networkDefaults.meta.binaryMode = configuration.binaryMode;
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
  "seedNetworkId",
  "seedNetworkRes",
  "successRate",
  "testCycleHistory",
  "testCycles",
];

const networkMetaPickArray = Object.keys(networkDefaults.meta);

NeuralNetworkTools.prototype.loadInputs = async function(params){
  await tcUtils.loadInputs({inputsObj: params.inputsObj});
  return;
}

NeuralNetworkTools.prototype.loadNetwork = async function(params){

  if (!params.networkObj || params.networkObj === undefined || (params.networkObj.network === undefined && params.networkObj.networkJson === undefined)) {
    console.log(chalkError("NNT | *** LOAD NETWORK UNDEFINED: " + params.networkObj));
    throw new Error("NNT | LOAD NETWORK UNDEFINED");
  }

  try{

    const nn = params.networkObj;

    nn.meta = defaults(nn.meta, networkDefaults.meta);

    statsObj.networks[nn.networkId] = {};
    statsObj.networks[nn.networkId] = pick(nn, networkPickArray);
    statsObj.networks[nn.networkId].meta = pick(nn.meta, networkMetaPickArray);

    if (!statsObj.bestNetwork 
      || (statsObj.bestNetwork === undefined)
      || (statsObj.bestNetwork === {})
    ) {
      statsObj.bestNetwork = {};
      statsObj.bestNetwork = pick(nn, networkPickArray);
      statsObj.bestNetwork.meta = pick(nn.meta, networkMetaPickArray);
    }

    if (!statsObj.currentBestNetwork 
      || (statsObj.currentBestNetwork === undefined)
      || (statsObj.currentBestNetwork === {})
    ) {
      statsObj.currentBestNetwork = {};
      statsObj.currentBestNetwork = pick(nn, networkPickArray);
      statsObj.currentBestNetwork.meta = pick(nn.meta, networkMetaPickArray);
    }

    if (params.isBestNetwork || (statsObj.bestNetwork.overallMatchRate < nn.overallMatchRate)) {
      printNetworkObj("NNT | --> LOAD BEST NETWORK", nn, chalk.green);
      statsObj.bestNetwork = pick(nn, networkPickArray);
      statsObj.bestNetwork.meta = pick(nn.meta, networkMetaPickArray);
    }

    if (statsObj.currentBestNetwork.overallMatchRate < nn.overallMatchRate){
      printNetworkObj("NNT | --> LOAD CURRENT BEST NETWORK", nn, chalk.green);
      statsObj.currentBestNetwork = pick(nn, networkPickArray);
      statsObj.currentBestNetwork.meta = pick(nn.meta, networkMetaPickArray);
    }

    let network;

    if (nn.networkTechnology === "carrot"){
      console.log(chalkWarn("NNT | ... LOAD NETWORK RAW | TECH: " + nn.networkTechnology + " | " + nn.networkId));
      network = nn.network;
    }
    else if (nn.networkTechnology === "neataptic"){
      if (params.networkIsRaw) {
        console.log(chalkWarn("NNT | ... LOAD NETWORK RAW | TECH: " + nn.networkTechnology + " | " + nn.networkId));
        network = nn.network;
      }
      else{
        console.log(chalkWarn("NNT | ... CONVERT+LOAD NETWORK FROM JSON | TECH: " + nn.networkTechnology + " | " + nn.networkId));
        network = neataptic.Network.fromJSON(nn.network);
      }
    }
    else {
      nn.networkTechnology = "neataptic";
      console.log(chalkAlert("NNT | ??? TRY CONVERT+LOAD NETWORK FROM JSON | ??? TECH: " + nn.networkTechnology + " | " + nn.networkId));
      try{
        network = neataptic.Network.fromJSON(nn.network);
      }
      catch(err){
        console.log(chalkAlert("NNT | ??? TRY LOAD NETWORK FROM JSON | ??? TECH: " + nn.networkTechnology + " | " + nn.networkId));
        network = nn.network;
      }
    }

    nn.network = {};
    nn.network = network;
    nn.networkRawFlag = true;

    try{

      if (tcUtils.inputsLoaded(nn.inputsId)){
        delete nn.inputsObj; // save memory
      }
      else if (nn.inputsObj && nn.inputsObj !== undefined){
        await tcUtils.loadInputs({inputsObj: nn.inputsObj});
        delete nn.inputsObj; // save memory
      }
      else {
        const file = nn.inputsId + ".json";

        console.log(chalkAlert("NNT | !!! NN INPUTS OBJ UNDEFINED ... SEARCHING FILE"
          + " | NN ID: " + nn.networkId
          + " | INPUTS ID: " + nn.inputsId
          + " | FOLDER: " + configuration.inputsFolder
          + " | FILE: " + file
        ));

        const inputsObj = await tcUtils.loadFileRetry({folder: configuration.inputsFolder, file: file});
        await tcUtils.loadInputs({inputsObj: nn.inputsObj});
        delete nn.inputsObj; // save memory

        if (!inputsObj) {
          console.log(chalkError("NNT | *** LOAD INPUTS ERROR"
            + " | NN ID: " + nn.networkId
            + " | INPUTS ID: " + nn.inputsId
            + " | INPUTS OBJ UNDEFINED IN NETWORK OBJ + INPUTS OBJ NOT PREVIOUSLY LOADED"
          ));
          throw new Error("INPUTS OBJ UNDEFINED IN NN: " + nn.networkId + " | INPUTS: " + nn.inputsId);          
        }
      }

      networksHashMap.set(nn.networkId, nn);

      console.log(chalkLog("NNT | --> LOAD NN: " + nn.networkId + " | " + networksHashMap.size + " NNs"));
      console.log(chalkLog("NNT | --> LOAD IN: " + nn.inputsId));

      return nn.networkId;
    }
    catch(err){
      console.log(chalkError("NNT | *** LOAD INPUTS ERROR"
        + " | NN ID: " + nn.networkId
        + " | INPUTS ID: " + nn.inputsId
        + " | " + err
      ));
      throw err;
    }

  }
  catch(err){
    console.log(chalkError("NNT | *** LOAD NN ERROR"
      + " | NN ID: " + params.networkObj.networkId
      + " | IN ID: " + params.networkObj.inputsId
      + " | " + err
    ));
    throw err;
  }
}

NeuralNetworkTools.prototype.deleteNetwork = async function(params){

  if (!params.networkId) {
    console.log(chalkError("NNT | *** DELETE NETWORK ID UNDEFINED: " + params.networkId));
    throw new Error("NNT | DELETE NETWORK ID UNDEFINED");
  }

  try{

    console.log(chalkError("NNT | XXX DELETE NETWORK: " + params.networkId));

    networksHashMap.delete(params.networkId);

    delete statsObj.networks[params.networkId];

    if (primaryNeuralNetworkId == params.networkId){
      console.log(chalkError("NNT | XXX DELETE PRIMARY NETWORK: " + params.networkId));
      primaryNeuralNetworkId = false;
    }

    if (statsObj.bestNetwork && (statsObj.bestNetwork !== undefined) && (statsObj.bestNetwork.networkId == params.networkId)){
      console.log(chalkError("NNT | XXX DELETE BEST NETWORK: " + params.networkId));
      delete statsObj.bestNetwork;
    }

    if (statsObj.currentBestNetwork && (statsObj.currentBestNetwork !== undefined) && (statsObj.currentBestNetwork.networkId == params.networkId)){
      console.log(chalkError("NNT | XXX DELETE CURRENT BEST NETWORK: " + params.networkId));
      delete statsObj.currentBestNetwork;
    }

    return;

  }
  catch(err){
    console.log(chalkError("NNT | *** DELETE NN ERROR"
      + " | NN ID: " + params.networkId
      + " | " + err
    ));
    throw err;
  }
}

const deleteNetwork = NeuralNetworkTools.prototype.deleteNetwork;

NeuralNetworkTools.prototype.setPrimaryNeuralNetwork = async function(nnId){

  if (!nnId || nnId === undefined) {
    console.log(chalkError("NNT | *** PRIMARY NETWORK ID UNDEFINED: " + nnId));
    return new Error("NNT | PRIMARY NETWORK ID UNDEFINED");
  }

  if (!networksHashMap.has(nnId)){
    console.log(chalkError("NNT | *** PRIMARY NETWORK NOT LOADED: " + nnId));
    return new Error("NNT | PRIMARY NETWORK NOT LOADED: " + nnId);
  }

  try{

    primaryNeuralNetworkId = nnId;
    const nnObj = networksHashMap.get(primaryNeuralNetworkId);

    if (!tcUtils.inputsLoaded(nnObj.inputsId)){

      if (nnObj.inputsObj && (nnObj.inputsObj !== undefined)){
        await tcUtils.loadInputs({inputsObj: nnObj.inputsObj});
      }
      else{      
        console.log(chalkError("NNT | *** setPrimaryNeuralNetwork PRIMARY NETWORK INPUTS NOT LOADED: " + nnObj.inputsId));
        return new Error("NNT | PRIMARY NETWORK INPUTS NOT LOADED: " + nnObj.inputsId);
      }
    }

    await tcUtils.setPrimaryInputs({inputsId: nnObj.inputsId});
  }
  catch(err){
    return err;
  }

  console.log(chalkLog("NNT | --> SET PRIMARY NN: " + primaryNeuralNetworkId));

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
      console.log(chalkError("NNT | *** printNetworkInput ERROR | datum.input UNDEFINED"));
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

    // if (previousPrintedNetworkObj && (previousPrintedNetworkObj.inputsId === params.datum.inputsId)) {
    //   previousPrintedNetworkObj.truncated = true;
    //   previousPrintedNetworkObj.title = params.title;
    //   outputNetworkInputText(previousPrintedNetworkObj);
    //   return resolve();
    // }

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
        console.log(chalkError("NNT | *** printNetworkInput ERROR: " + err));
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
      + " | " + statsObj.currentBestNetwork.networkId
      + " | " + statsObj.currentBestNetwork.inputsId
      + " | RANK: " + statsObj.currentBestNetwork.rank
      + " | TECH: " + statsObj.currentBestNetwork.networkTechnology
      + " | " + statsObj.currentBestNetwork.meta.match + "/" + statsObj.currentBestNetwork.meta.total
      + " | MR: " + statsObj.currentBestNetwork.matchRate.toFixed(2) + "%"
      + " | BIN MODE: " + statsObj.currentBestNetwork.meta.binaryMode
      + " | OUT: " + statsObj.currentBestNetwork.meta.output
      + " | CM: " + statsObj.currentBestNetwork.meta.category
      + " | CA: " + statsObj.currentBestNetwork.meta.categoryAuto
      + " | " + statsObj.currentBestNetwork.meta.matchFlag;

    if (!params.title) { params.title = titleDefault; }

    const sortedNetworksArray = _.sortBy(networksHashMap.values(), ["matchRate"]);
    _.reverse(sortedNetworksArray);

    async.eachOfSeries(sortedNetworksArray, function(n, index, cb0){

      const nn = defaults(n, networkDefaults);
      nn.meta = defaults(n.meta, networkDefaults.meta);

      statsTextArray[index] = [];
      statsTextArray[index] = [
        "NNT | ",
        nn.rank,
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
        "NNT | ",
        "RANK",
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
        + table(statsTextArray, { align: ["l", "r", "l", "l", "l", "r", "r", "r", "r", "r", "l", "l", "r", "r", "r", "r", "r"] })
        + "\nNNT | -------------------------------------------------------------------------------------------------------------------------------------------------"
      ));

      resolve();

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
  const overallMatchRate = nn.overallMatchRate || 0;
  const matchRate = nn.matchRate || 0;
  const successRate = nn.successRate || 0;
  const testCycleHistory = nn.testCycleHistory || [];

  console.log(chalkFormat(title
    + " | RK: " + rank
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
        return reject(new Error("NNT | updateNetworkStats NN UNDEFINED | NN ID: " + nnId));
      }

      nn = defaults(nn, networkDefaults);
      nn.meta = defaults(nn.meta, networkDefaults.meta);

      if (!statsObj.networks[nnId] || statsObj.networks[nnId] === undefined || statsObj.networks[nnId] === {}) {
        statsObj.networks[nnId] = {};
        statsObj.networks[nnId] = networkDefaults;
        statsObj.networks[nnId].meta = defaults(statsObj.networks[nnId].meta, networkDefaults.meta);
      }

      statsObj.networks[nnId] = pick(nn, networkPickArray);
      statsObj.networks[nnId].meta = nn.meta;
      statsObj.networks[nnId].categoryAuto = arrayToCategory(networkOutput[nnId].output);
      statsObj.networks[nnId].meta.category = user.category;
      statsObj.networks[nnId].meta.categoryAuto = arrayToCategory(networkOutput[nnId].output);

      networkOutput[nnId].category = user.category;
      networkOutput[nnId].categoryAuto = arrayToCategory(networkOutput[nnId].output);

      statsObj.networks[nnId].meta.output = [];
      statsObj.networks[nnId].meta.output = networkOutput[nnId].output;
      statsObj.networks[nnId].meta[user.category] += 1;
      statsObj.networks[nnId].meta.total += 1;

      if (networkOutput[nnId].categoryAuto == user.category) {
        statsObj.networks[nnId].meta.match += 1;
        statsObj.networks[nnId].meta.matchFlag = "MATCH";
        chalkCategory = chalk.green;
      }
      else {
        statsObj.networks[nnId].meta.mismatch += 1;
        statsObj.networks[nnId].meta.matchFlag = "MISS";
        chalkCategory = chalk.gray;
      }

      if (verbose){
        console.log(chalkCategory("NNT | " + statsObj.networks[nnId].meta.matchFlag
          + " | @" + user.screenName
          + " | CM: " + user.category + " | CA: " + networkOutput[nnId].categoryAuto
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
      nn.matchRate = statsObj.networks[nnId].matchRate;
      nn.overallMatchRate = statsObj.networks[nnId].overallMatchRate;
      nn.successRate = statsObj.networks[nnId].successRate;
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
              printNetworkObj("NNT | +++ NEW CURRENT BEST NETWORK    | " + nn.meta.match + "/" + nn.meta.total, nn, chalk.green);
            }
            statsObj.currentBestNetwork = pick(nn, networkPickArray);
            statsObj.currentBestNetwork.meta = pick(nn.meta, networkMetaPickArray);
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

NeuralNetworkTools.prototype.activateSingleNetwork = async function (params) {

  const binaryMode = (params.binaryMode !== undefined) ? params.binaryMode : configuration.binaryMode;
  const verbose = configuration.verbose || params.verbose;
  const nnId = params.networkId || primaryNeuralNetworkId;

  if (!networksHashMap.has(nnId)){
    console.log(chalkError("NNT | NN NETWORK NOT IN HASHMAP" + nnId));
    throw new Error("NN NOT IN NETWORK HASHMAP: " + nnId);
  }

  const nnObj = networksHashMap.get(nnId);
  nnObj.meta.binaryMode = binaryMode;

  if (!nnObj.network || (nnObj.network === undefined)){
    console.log(chalkError("NNT | *** NN NETWORK UNDEFINED" + nnId));
    await deleteNetwork(nnId);
    throw new Error("NN NETWORK UNDEFINED: " + nnId);
  }

  if (!nnObj.networkRawFlag || (nnObj.networkRawFlag === undefined) || (nnObj.network.activate === undefined)){

    console.log(chalkAlert("NNT | NN NETWORK ACTIVATE UNDEFINED"
      + " | TECH: " + nnObj.networkTechnology 
      + " | ID: " + nnObj.networkId 
      + " | INPUTS: " + nnObj.inputsId 
      + " | NN RAW FLAG: " + nnObj.networkRawFlag 
    ));

    networksHashMap.delete(nnId);

    throw new Error("ACTIVATE_UNDEFINED: " + nnObj.networkId);

  }

  const results = await tcUtils.convertDatum({datum: params.user, inputsId: nnObj.inputsId, binaryMode: binaryMode, verbose: verbose});

  if (!results || results === undefined) {
    console.log("NNT | *** CONVERT DATUM ERROR | NO RESULTS");
    throw new Error("CONVERT DATUM ERROR | NO RESULTS")
  }

  if (verbose) {
    console.log(chalkLog("NNT | CONVERT DATUM"
      + " | @" + results.datum.screenName
      + " | INPUTS ID: " + results.datum.inputsId
      + " | H/M/TOT: " + results.inputHits + "/" + results.inputMisses + "/" + results.datum.numInputs
      + " | INPUT HIT RATE: " + results.inputHitRate.toFixed(3) + "%"
    ));
  }

  const outputRaw = nnObj.network.activate(results.datum.input);

  const networkOutput = {};
  networkOutput.nnId = nnId;
  networkOutput.user = {};
  networkOutput.user.nodeId = params.user.nodeId;
  networkOutput.user.screenName = params.user.screenName;
  networkOutput.user.category = params.user.category;
  networkOutput.user.categoryAuto = params.user.categoryAuto;
  networkOutput.binaryMode = binaryMode;
  networkOutput.outputRaw = [];
  networkOutput.outputRaw = outputRaw;
  networkOutput.output = [];
  networkOutput.output = [0,0,0];
  networkOutput.categoryAuto = "none";
  networkOutput.matchFlag = "MISS";
  networkOutput.inputHits = results.inputHits;
  networkOutput.inputMisses = results.inputMisses;
  networkOutput.inputHitRate = results.inputHitRate;

  if (outputRaw.length !== 3) {
    console.log(chalkError("NNT | *** NETWORK OUTPUT SIZE !== 3  | " + nnId + " | outputRaw: " + outputRaw));
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
      + " | INPUT: " + nnObj.inputsId 
      + " | INPUT H/M/RATE: " + networkOutput.inputHits + "/" + networkOutput.inputMisses + "/" + networkOutput.inputHitRate.toFixed(3)
      + " | @" + params.user.screenName 
      + " | C: " + params.user.category 
      + " | A: " + networkOutput.categoryAuto
      + " | MATCH: " + networkOutput.matchFlag;

  if (verbose) {
    await printNetworkInput({
      title: title,
      datum: results.datum
    });
  }

  return networkOutput;
};

const activateSingleNetwork = NeuralNetworkTools.prototype.activateSingleNetwork;

NeuralNetworkTools.prototype.activate = function (params) {

  return new Promise(function(resolve, reject){


    if (networksHashMap.size === 0) {
      console.log(chalkError("NNT | *** NO NETWORKS IN HASHMAP"));
      return reject(new Error("NNT | *** NO NETWORKS IN HASHMAP"));
    }

    const binaryMode = (params.binaryMode !== undefined) ? params.binaryMode : configuration.binaryMode;
    const verbose = params.verbose || false;
    const user = params.user;

    if (!user.profileHistograms || (user.profileHistograms === undefined)) {
      console.log(chalkWarn("NNT | UNDEFINED USER PROFILE HISTOGRAMS | @" + user.screenName));
      user.profileHistograms = {};
    }

    if (!user.tweetHistograms || (user.tweetHistograms === undefined)) {
      console.log(chalkWarn("NNT | UNDEFINED USER TWEET HISTOGRAMS | @" + user.screenName + "\n" + jsonPrint(params)));
      user.tweetHistograms = {};
    }

    if (!user.friends || (user.friends === undefined)) {
      console.log(chalkWarn("NNT | UNDEFINED USER FRIENDS | @" + user.screenName));
      user.friends = [];
    }

    const networkOutput = {};
    const nnIdArray = networksHashMap.keys();

    async.each(nnIdArray, function(nnId, cb){

      if (!networksHashMap.has(nnId)){
        return reject(new Error("NNT | NET NOT IN HASHMAP | NN ID: " + nnId));
      }

      networkOutput[nnId] = {};

      activateSingleNetwork({networkId: nnId, user: user, binaryMode: binaryMode, verbose: verbose})
      .then(function(output){
        networkOutput[nnId] = output;
        cb();
      })
      .catch(function(e){
        console.log(chalkError("NNT | activateSingleNetwork | *** ACTIVATE NETWORK ERROR"
          + " | " + nnId
          + " | " + e
        ));
        cb(e);
      });
    }, function(err){

      if (err) {
        console.log(chalkError("NNT | *** ACTIVATE NETWORK ERROR (async callback)"
          + " | " + err
        ));
        return reject(err);
      }

      resolve({ user: user, networkOutput: networkOutput });
    });
  });
};

module.exports = NeuralNetworkTools;
