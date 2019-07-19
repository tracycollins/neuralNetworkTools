/*jslint node: true */
/*jshint sub:true*/

const neataptic = require("neataptic");
// const carrot = require("@liquid-carrot/carrot");
const assert = require("assert");
// const should = require("should");
const async = require("async");
const util = require("util");
const _ = require("lodash");
const EventEmitter = require("events");
const MergeHistograms = require("@threeceelabs/mergehistograms");
const mergeHistograms = new MergeHistograms();
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
const inputsHashMap = new HashMap();

let primaryNeuralNetworkId;
// let primaryNetworkObj;

const configuration = {};
configuration.verbose = false;

const statsObj = {};
statsObj.networks = {};
statsObj.bestNetwork = {};
statsObj.currentBestNetwork = {};

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

networkDefaults.meta.output = [];
networkDefaults.meta.total = 0;
networkDefaults.meta.match = 0;
networkDefaults.meta.mismatch = 0;

networkDefaults.meta.left = 0;
networkDefaults.meta.neutral = 0;
networkDefaults.meta.right = 0;
networkDefaults.meta.none = 0;
networkDefaults.meta.positive = 0;
networkDefaults.meta.negative = 0;

const networkPickArray = [
  "inputsId",
  "inputsObj",
  "matchRate",
  "meta",
  "networkId",
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

console.log("networkMetaPickArray\n" + jsonPrint(networkMetaPickArray));

const currentBestNetworkPicks = [
  "inputsId",
  "matchFlag",
  "matchRate",
  "meta",
  "networkId",
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

NeuralNetworkTools.prototype.loadNetwork = function(params){

  return new Promise(async function(resolve, reject){

    if (!params.networkObj || params.networkObj === undefined || params.networkObj.network === undefined) {
      console.log(chalkError("NNT | *** LOAD NETWORK UNDEFINED: " + params.networkObj));
      return reject(new Error("NNT | LOAD NETWORK UNDEFINED"));
    }

    try{

      const nn = params.networkObj;

      nn.meta = networkDefaults.meta;

      assert.equal(nn.meta, networkDefaults.meta);

      statsObj.networks[nn.networkId] = {};
      statsObj.networks = pick(nn, networkPickArray);
      statsObj.networks.meta = {};
      statsObj.networks.meta = networkDefaults.meta;

      if (params.isBestNetwork) {

        printNetworkObj("NNT | --> LOAD BEST NETWORK", nn, chalkAlert);

        statsObj.bestNetwork = {};
        statsObj.bestNetwork = pick(nn, networkPickArray);
        statsObj.bestNetwork.meta = {};
        statsObj.bestNetwork.meta = networkDefaults.meta;

      }

      if (!statsObj.currentBestNetwork || statsObj.currentBestNetwork === undefined || statsObj.currentBestNetwork === {}){

        printNetworkObj("NNT | --> LOAD CURRENT BEST NETWORK", nn, chalk.green);

        statsObj.currentBestNetwork.meta = {};
        statsObj.currentBestNetwork.meta = nn.meta;
        statsObj.currentBestNetwork = pick(nn, currentBestNetworkPicks);


      }
      if (statsObj.currentBestNetwork.matchRate < nn.matchRate){

        printNetworkObj("NNT | --> UPDATE CURRENT BEST NETWORK", nn, chalk.green);

        statsObj.currentBestNetwork.meta = nn.meta;
        statsObj.currentBestNetwork = pick(nn, currentBestNetworkPicks);
      }

      // should.exist(nn.network);

      const network = neataptic.Network.fromJSON(nn.network);

      nn.network = network;

      const inputsObj = nn.inputsObj;

      inputsHashMap.set(nn.inputsId, inputsObj);

      try{
        await tcUtils.loadInputs({inputsObj: inputsObj});
      }
      catch(err){
        console.log(chalkError("NNT | *** LOAD INPUTS ERROR: " + err));
      }

      delete nn.inputsObj; // save memory

      networksHashMap.set(nn.networkId, nn);

      console.log(chalkLog("NNT | --> LOAD NN: " + nn.networkId + " | " + networksHashMap.size + " NNs"));
      console.log(chalkLog("NNT | --> LOAD IN: " + nn.inputsId + " | " + inputsHashMap.size + " INPUT OBJs"));

      resolve(nn.networkId);

    }
    catch(err){
      console.log(chalkError("NNT | *** LOAD NN ERROR: " + err));
      reject(err);
    }

  });
}

NeuralNetworkTools.prototype.setPrimaryNeuralNetwork = function(nnId){

  return new Promise(async function(resolve, reject){

    if (!nnId || nnId === undefined) {
      console.log(chalkError("NNT | *** PRIMARY NETWORK ID UNDEFINED: " + nnId));
      return reject(new Error("NNT | PRIMARY NETWORK ID UNDEFINED"));
    }

    if (!networksHashMap.has(nnId)){
      console.log(chalkError("NNT | *** PRIMARY NETWORK NOT LOADED: " + nnId));
      return reject(new Error("NNT | PRIMARY NETWORK NOT LOADED: " + nnId));
    }

    primaryNeuralNetworkId = nnId;
    const nnObj = networksHashMap.get(primaryNeuralNetworkId);

    if (!inputsHashMap.has(nnObj.inputsId)){
      console.log(chalkError("NNT | *** setPrimaryNeuralNetwork PRIMARY NETWORK INPUTS NOT IN HASHMAP: " + nnObj.inputsId));
      return reject(new Error("NNT | PRIMARY NETWORK INPUTS NOT IN HASHMAP: " + nnObj.inputsId));
    }

    try{
      await tcUtils.setPrimaryInputs({inputsId: nnObj.inputsId});
    }
    catch(err){
      return reject(err);
    }

    console.log(chalkLog("NNT | --> SET PRIMARY NN: " + primaryNeuralNetworkId));

    resolve(primaryNeuralNetworkId);

  });
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

    if (previousPrintedNetworkObj && (previousPrintedNetworkObj.inputsId === params.datum.inputsId)) {
      previousPrintedNetworkObj.truncated = true;
      previousPrintedNetworkObj.title = params.title;
      outputNetworkInputText(previousPrintedNetworkObj);
      return resolve();
    }

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

    let params = {};
    params = params || p;

    // statsObj.currentBestNetwork = defaults(statsObj.currentBestNetwork, networkDefaults);
    // statsObj.currentBestNetwork.meta = defaults(statsObj.currentBestNetwork.meta, networkDefaults.meta);

    titleDefault = "BEST"
      + " | " + statsObj.currentBestNetwork.networkId
      + " | " + statsObj.currentBestNetwork.inputsId
      + " | RANK: " + statsObj.currentBestNetwork.rank
      + " | " + statsObj.currentBestNetwork.meta.match + "/" + statsObj.currentBestNetwork.meta.total
      + " | MR: " + statsObj.currentBestNetwork.matchRate.toFixed(2) + "%"
      + " | OUT: " + statsObj.currentBestNetwork.meta.output
      + " | " + statsObj.currentBestNetwork.meta.matchFlag;

    if (!params.title) { params.title = titleDefault; }

    const sortedNetworksArray = _.sortBy(networksHashMap.values(), ["matchRate"]);
    _.reverse(sortedNetworksArray);

    async.eachOfSeries(sortedNetworksArray, function(nn, index, cb0){

      if (nn.meta === undefined) {
        nn.meta = {};
        nn.meta = defaults(nn.meta, networkDefaults.meta);
        console.log("nn.meta\n" + jsonPrint(nn.meta));
      }

      if (!nn.testCycleHistory || nn.testCycleHistory === undefined) {
        nn.testCycleHistory = [];
        console.log("nn.testCycleHistory\n" + jsonPrint(nn.testCycleHistory));
      }

      if (nn.meta.matchFlag === undefined) { nn.meta.matchFlag = false; }
      if (nn.meta.output.length === 0) { nn.meta.output = "---"; }

      statsTextArray[index] = [];
      statsTextArray[index] = [
        "NNT | ",
        nn.rank,
        nn.networkId,
        nn.inputsId,
        nn.numInputs,
        nn.overallMatchRate.toFixed(2),
        nn.successRate.toFixed(2),
        nn.testCycles,
        nn.testCycleHistory.length,
        nn.meta.matchFlag,
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
        "NNID",
        "INPUTSID",
        "INPUTS",
        "OAMR",
        "SR",
        "TCs",
        "TCH",
        "MFLAG",
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
        + table(statsTextArray, { align: ["l", "r", "l", "l", "r", "r", "r", "r", "r", "l", "r", "r", "r", "r", "r"] })
        + "\nNNT | -------------------------------------------------------------------------------------------------------------------------------------------------"
      ));

      resolve();

    });

  });
}

const printNetworkResults = NeuralNetworkTools.prototype.printNetworkResults;
const printNetworkInput = NeuralNetworkTools.prototype.printNetworkInput;

function arrayToCategory(arr){
  if (_.isEqual(arr, [0,0,0])) { return "none"; }
  if (_.isEqual(arr, [1,0,0])) { return "left"; }
  if (_.isEqual(arr, [0,1,0])) { return "neutral"; }
  if (_.isEqual(arr, [0,0,1])) { return "right"; }
  throw new Error("INVALID ARR arrayToCategory");
}

function printNetworkObj(title, nObj, format) {

  const chalkFormat = (format !== undefined) ? format : chalk.blue;

  const nn = defaults(nObj, networkDefaults);

  console.log(chalkFormat(title
    + " | RK: " + nn.rank.toFixed(0)
    + " | OR: " + nn.overallMatchRate.toFixed(2) + "%"
    + " | MR: " + nn.matchRate.toFixed(2) + "%"
    + " | SR: " + nn.successRate.toFixed(2) + "%"
    + " | CR: " + tcUtils.getTimeStamp(nn.createdAt)
    + " | TC:  " + nn.testCycles
    + " | TH: " + nn.testCycleHistory.length
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

    const verbose = params.verbose; // array of networks

    const networkOutput = params.networkOutput; // array of networks
    const user = params.user; 

    const nnIdArray = Object.keys(networkOutput);

    let chalkCategory = chalk.gray;

    async.eachSeries(nnIdArray, function(nnId, cb){

      const nn = networksHashMap.get(nnId);

      if (!nn || nn === undefined) {
        return reject(new Error("NNT | updateNetworkStats NN UNDEFINED"));
      }

      statsObj.networks[nnId] = pick(nn, networkPickArray);
      statsObj.networks[nnId].meta = pick(nn.meta, networkMetaPickArray);
      statsObj.networks[nnId].categoryAuto = arrayToCategory(networkOutput[nnId].output);

      networkOutput[nnId].categoryAuto = statsObj.networks[nnId].categoryAuto;

      statsObj.networks[nnId].meta.output = [];
      statsObj.networks[nnId].meta.output = networkOutput[nnId].output;
      statsObj.networks[nnId].meta[user.category] += 1;
      statsObj.networks[nnId].meta.total += 1;

      if (networkOutput[nnId].categoryAuto === user.category) {
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
      nn.matchFlag = statsObj.networks[nnId].matchFlag;
      nn.matchRate = statsObj.networks[nnId].matchRate;
      nn.overallMatchRate = statsObj.networks[nnId].overallMatchRate;
      nn.successRate = statsObj.networks[nnId].successRate;
      nn.testCycleHistory = statsObj.networks[nnId].testCycleHistory;
      nn.testCycles = statsObj.networks[nnId].testCycles;
      nn.output = statsObj.networks[nnId].output;
      nn.meta = statsObj.networks[nnId].meta;

      networksHashMap.set(nnId, nn);

      async.setImmediate(function() { return cb(); });

    }, function(err2){

      if (err2) {
        return reject(err2);
      }

      try {

        const sortedNetworksArray = _.sortBy(networksHashMap.values(), ["matchRate"]);
        _.reverse(sortedNetworksArray);

        async.eachOfSeries(sortedNetworksArray, function(nn, index, cb1){

          nn.rank = index;

          networksHashMap.set(nn.networkId, nn);

          if (statsObj.bestNetwork.networkId === nn.networkId){
            statsObj.bestNetwork = pick(nn, currentBestNetworkPicks);
            statsObj.bestNetwork.meta = nn.meta;
            if (verbose) {
              printNetworkObj("NNT | ^^^ UPDATE BEST NETWORK | " + nn.meta.match + "/" + nn.meta.total, nn, chalk.black);
            }
          }

          if (statsObj.currentBestNetwork.networkId === nn.networkId){
            statsObj.currentBestNetwork = pick(nn, currentBestNetworkPicks);
            statsObj.currentBestNetwork.meta = nn.meta;
            // printNetworkObj("NNT | ^^^ UPDATE CURRENT BEST NETWORK | " + nn.meta.match + "/" + nn.meta.total, nn, chalk.gray);
          }
          else if (statsObj.currentBestNetwork.matchRate < nn.matchRate) {
            statsObj.currentBestNetwork = pick(nn, currentBestNetworkPicks);
            statsObj.currentBestNetwork.meta = nn.meta;
            printNetworkObj("NNT | +++ NEW CURRENT BEST NETWORK    | " + nn.meta.match + "/" + nn.meta.total, nn, chalk.green.bold);
          }
          
          async.setImmediate(function() { return cb1(); });

        }, async function(err1){

          if (err1) {
            return reject(err1);
          }

          // if (verbose) { printNetworkResults(); }
          statsObj.currentBestNetwork = defaults(statsObj.currentBestNetwork, networkDefaults);

          resolve(statsObj.currentBestNetwork);
        });

      }
      catch(err){
        console.trace(chalkError("NNT | *** updateNetworkStats ERROR: " + err));
        reject(err);
      }

    });
  });
}

NeuralNetworkTools.prototype.activateSingleNetwork = function (params) {

  return new Promise(async function(resolve, reject){

    try {

      const verbose = configuration.verbose || params.verbose;

      const nnId = params.networkId;
      const nnObj = networksHashMap.get(nnId);

      const convertDatumObj = await tcUtils.convertDatum({datum: params.user, inputsId: nnObj.inputsId});

      const outputRaw = nnObj.network.activate(convertDatumObj.input);

      if (outputRaw.length !== 3) {
        console.log(chalkError("NNT | *** ZERO LENGTH NETWORK OUTPUT | " + nnId ));
        return reject("ZERO LENGTH NETWORK OUTPUT");
      }

      const networkOutput = {};
      networkOutput.nnId = nnId;
      networkOutput.outputRaw = [];
      networkOutput.outputRaw = outputRaw;
      networkOutput.output = [];
      networkOutput.categoryAuto = "none";
      networkOutput.matchFlag = "MISS";

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

      // console.log("NNT | ACTIVATE"
      //   + " | INPUT: " + nnObj.inputsId 
      //   + " | @" + params.user.screenName 
      //   + " | C: " + params.user.category 
      //   + " | A: " + networkOutput.categoryAuto
      //   + " | MATCH: " + networkOutput.matchFlag
      // );

      if (verbose) {
        await printNetworkInput({
          title: nnObj.networkId
          + " | INPUT: " + nnObj.inputsId 
          + " | @" + params.user.screenName 
          + " | C: " + params.user.category 
          + " | A: " + networkOutput.categoryAuto
          + " | MATCH: " + networkOutput.matchFlag,
          datum: convertDatumObj
        });
      }

      resolve(networkOutput);
    }
    catch(err){
      console.log(chalkError("NNT | *** ERROR ACTIVATE NETWORK", err));
      return reject(err);
    }
  });
};

const activateSingleNetwork = NeuralNetworkTools.prototype.activateSingleNetwork;


NeuralNetworkTools.prototype.activate = function (params) {

  return new Promise(async function(resolve, reject){

    try {

      if (networksHashMap.size === 0) {
        console.log(chalkError("NNT | *** NO NETWORKS IN HASHMAP"));
        return reject(new Error("NNT | *** NO NETWORKS IN HASHMAP"));
      }

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

      async.eachSeries(nnIdArray, async function(nnId){

        if (!networksHashMap.has(nnId)){
          return reject(new Error("NNT | NET NOT IN HASHMAP | NN ID: " + nnId));
        }

        networkOutput[nnId] = {};
        networkOutput[nnId] = await activateSingleNetwork({networkId: nnId, user: user});

        return;

      }, function(err){

        if (err) {
          console.log(chalkError("NNT | *** ACTIVATE NETWORK ERROR (async callback)", err));
          return reject(err);
        }

        resolve({ user: user, networkOutput: networkOutput });

      });

    }
    catch(err){

      console.log(chalkError("NNT | *** ACTIVATE NETWORK ERROR", err));
      reject(err);
    }

  });
};

module.exports = NeuralNetworkTools;
