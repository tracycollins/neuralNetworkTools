/*jslint node: true */
/*jshint sub:true*/

const neataptic = require("neataptic");
// const carrot = require("@liquid-carrot/carrot");

// const networkTechnology = "neataptic";

const async = require("async");
const util = require("util");
const _ = require("lodash");
const EventEmitter = require("events");
const MergeHistograms = require("@threeceelabs/mergehistograms");
const mergeHistograms = new MergeHistograms();
const HashMap = require("hashmap").HashMap;
const deepcopy = require("deep-copy");
const defaults = require("object.defaults");

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
configuration.verbose = false;

const statsObj = {};
statsObj.loadedNetworks = {};

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

NeuralNetworkTools.prototype.loadNetwork = function(params){

  return new Promise(function(resolve, reject){

    if (!params.networkObj || params.networkObj === undefined || params.networkObj.network === undefined) {
      console.log(chalkError("NNT | *** LOAD NETWORK UNDEFINED: " + params.networkObj));
      return reject(new Error("NNT | LOAD NETWORK UNDEFINED"));
    }

    try{
      let nnObj = deepcopy(params.networkObj);

      nnObj = defaults(nnObj, networkMetaDefaults);

      const network = neataptic.Network.fromJSON(nnObj.network);

      nnObj.network = network;

      networksHashMap.set(nnObj.networkId, nnObj);

      console.log(chalkLog("NNT | --> LOAD NN: " + nnObj.networkId));

      resolve(nnObj.networkId);
    }
    catch(err){
      console.log(chalkError("NNT | *** LOAD NN ERROR: " + err));
      reject(err);
    }

  });
}

NeuralNetworkTools.prototype.setPrimaryNeuralNetwork = function(nnId){

  return new Promise(function(resolve, reject){

    if (!nnId || nnId === undefined) {
      console.log(chalkError("NNT | *** PRIMARY NETWORK ID UNDEFINED: " + nnId));
      return reject(new Error("NNT | PRIMARY NETWORK ID UNDEFINED"));
    }

    if (!networksHashMap.has(nnId)){
      console.log(chalkError("NNT | *** PRIMARY NETWORK NOT LOADED: " + nnId));
      return reject(new Error("NNT | PRIMARY NETWORK NOT LOADED: " + nnId));
    }

    primaryNeuralNetworkId = nnId;

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

    if (!params.inputsObj.input || params.inputsObj.input === undefined){
      console.log(chalkError("NNT | *** printNetworkInput ERROR | inputsObj.input UNDEFINED"));
      return reject();
    }

    const inputArray = params.inputsObj.input;
    const nameArray = params.inputsObj.name;
    const columns = params.columns || 100;

    let col = 0;
    let hitRowArray = [];

    let inputText = ".";
    let text = "";
    let textRow = "";
    let hits = 0;
    let hitRate = 0;
    const inputArraySize = inputArray.length;

    if (previousPrintedNetworkObj && (previousPrintedNetworkObj.inputsId === params.inputsObj.inputsId)) {
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
        inputsId: params.inputsObj.inputsId,
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

const printNetworkInput = NeuralNetworkTools.prototype.printNetworkInput;

// const arrayOfArrays = [];
let nnIdArray = [];
let currentBestNetwork;

function arrayToCategory(arr){
  if (_.isEqual(arr, [0,0,0])) { return "none"; }
  if (_.isEqual(arr, [1,0,0])) { return "left"; }
  if (_.isEqual(arr, [0,1,0])) { return "neutral"; }
  if (_.isEqual(arr, [0,0,1])) { return "right"; }
  throw new Error("INVALID ARR arrayToCategory");
}

const networkDefaults = function (networkObj){

  if (networkObj.betterChild === undefined) { networkObj.betterChild = false; }
  if (networkObj.testCycles === undefined) { networkObj.testCycles = 0; }
  if (networkObj.testCycleHistory === undefined) { networkObj.testCycleHistory = []; }
  if (networkObj.overallMatchRate === undefined) { networkObj.overallMatchRate = 0; }
  if (networkObj.matchRate === undefined) { networkObj.matchRate = 0; }
  if (networkObj.successRate === undefined) { networkObj.successRate = 0; }

  return networkObj;
};

function printNetworkObj(title, nObj, format) {

  const chalkFormat = (format !== undefined) ? format : chalk.blue;

  const networkObj = networkDefaults(nObj);

  console.log(chalkFormat(title
    + " | RANK: " + networkObj.rank.toFixed(0)
    + " | ARCHVD: " + networkObj.archived
    + " | OAMR: " + networkObj.overallMatchRate.toFixed(2) + "%"
    + " | MR: " + networkObj.matchRate.toFixed(2) + "%"
    + " | SR: " + networkObj.successRate.toFixed(2) + "%"
    + " | CR: " + tcUtils.getTimeStamp(networkObj.createdAt)
    + " | TC:  " + networkObj.testCycles
    + " | TCH: " + networkObj.testCycleHistory.length
    + " | INs: " + networkObj.numInputs
    + " | IN ID:  " + networkObj.inputsId
    + " | " + networkObj.networkId
  ));

  return;
}


NeuralNetworkTools.prototype.updateNetworkStats = function (params){

  return new Promise(function(resolve, reject){

    const networkOutput = params.networkOutput; // array of networks
    const expectedCategory = params.expectedCategory; // "left", "right", "neutral"

    if (!expectedCategory || expectedCategory === undefined) {
      console.log(chalkWarn("NNT | ??? updateNetworkStats | EXPECTED CATEGORY UNDEFINED: " + expectedCategory));
    }

    nnIdArray = Object.keys(networkOutput);

    async.eachSeries(nnIdArray, async function(nnId){

      const nn = networksHashMap.get(nnId);

      if (!nn || nn === undefined) {
        return reject(new Error("NNT | updateNetworkStats NN UNDEFINED"));
      }

      if (statsObj.loadedNetworks[nnId] === undefined) {
        // console.log(chalkAlert("INIT statsObj.loadNetworks " + nnId));
        statsObj.loadedNetworks[nnId] = {};
        statsObj.loadedNetworks[nnId].networkId = nnId;
        statsObj.loadedNetworks[nnId].inputsId = nn.inputsId;
        statsObj.loadedNetworks[nnId].numInputs = nn.numInputs;
        statsObj.loadedNetworks[nnId].output = [];
        statsObj.loadedNetworks[nnId].successRate = nn.successRate;
        statsObj.loadedNetworks[nnId].matchRate = nn.matchRate;
        statsObj.loadedNetworks[nnId].overallMatchRate = nn.overallMatchRate;
        statsObj.loadedNetworks[nnId].rank = Infinity;
        statsObj.loadedNetworks[nnId].total = 0;
        statsObj.loadedNetworks[nnId].match = 0;
        statsObj.loadedNetworks[nnId].mismatch = 0;
        statsObj.loadedNetworks[nnId].matchFlag = false;
        statsObj.loadedNetworks[nnId].left = 0;
        statsObj.loadedNetworks[nnId].neutral = 0;
        statsObj.loadedNetworks[nnId].right = 0;
        statsObj.loadedNetworks[nnId].positive = 0;
        statsObj.loadedNetworks[nnId].negative = 0;
        statsObj.loadedNetworks[nnId].none = 0;
      }

      nn.categoryAuto = arrayToCategory(networkOutput[nnId].output);
      networkOutput[nnId].categoryAuto = nn.categoryAuto;

      nn.meta.output = networkOutput[nnId].output;
      nn.meta[expectedCategory] += 1;
      nn.meta.total += 1;

      if (networkOutput[nnId].categoryAuto === expectedCategory) {
        nn.meta.match += 1;
        nn.meta.matchFlag = true;
      }
      else {
        nn.meta.mismatch += 1;
        nn.meta.matchFlag = false;
      }

      nn.matchRate = 100.0 * nn.meta.match / nn.meta.total;

      statsObj.loadedNetworks[nnId][expectedCategory] = nn.meta[expectedCategory];
      statsObj.loadedNetworks[nnId].total = nn.meta.total;
      statsObj.loadedNetworks[nnId].match = nn.meta.match;
      statsObj.loadedNetworks[nnId].mismatch += nn.meta.mismatch;
      statsObj.loadedNetworks[nnId].successRate = nn.successRate;
      statsObj.loadedNetworks[nnId].overallMatchRate = nn.overallMatchRate;
      statsObj.loadedNetworks[nnId].matchRate = nn.matchRate;
      statsObj.loadedNetworks[nnId].matchFlag = nn.meta.matchFlag;

      if ((!currentBestNetwork 
        || (currentBestNetwork === undefined) 
        || currentBestNetwork.matchRate === undefined) 
        || (nn.meta.matchRate > currentBestNetwork.matchRate)
      ){

        currentBestNetwork = statsObj.loadedNetworks[nnId];

        printNetworkObj("NNT | +++ NEW BEST NETWORK | " + nn.meta.match + "/" + nn.meta.total, nn, chalk.blue);

        // console.log(chalk.black.bold("NNT | +++ NET BEST NETWORK"
        //   + " | " + nn.matchRate.toFixed(2)
        //   + " | " + nn.networkId
        //   + " | " + currentBestNetwork.match + "/" + currentBestNetwork.total
        // ));
      }

      networksHashMap.set(nnId, nn);

      return;

    }, async function(){

      try {

        const sortedNetworksArray = _.sortBy(networksHashMap.values(), ["matchRate"]);
        _.reverse(sortedNetworksArray);

        // console.log("BEST NETWORK\n" + jsonPrint(sortedNetworksArray[0]));

        async.eachOfSeries(sortedNetworksArray, function(nn, index, cb1){
          nn.rank = index;
          printNetworkObj("NNT", nn, chalk.blue);
          networksHashMap.set(nn.networkId, nn);
          cb1();
        }, function(){
          resolve(currentBestNetwork);
        });

      }
      catch(err){
        console.trace(chalkError("NNT | *** updateNetworkStats ERROR: " + err));
        reject(err);
      }

    });

  });
}

const networkMetaDefaults = {};

networkMetaDefaults.matchRate = 0;
networkMetaDefaults.overallMatchRate = 0;
networkMetaDefaults.successRate = 0;
networkMetaDefaults.rank = Infinity;

networkMetaDefaults.meta = {};
networkMetaDefaults.meta = {};
networkMetaDefaults.meta = {};

networkMetaDefaults.meta.output = [];

networkMetaDefaults.meta.total = 0;
networkMetaDefaults.meta.match = 0;
networkMetaDefaults.meta.mismatch = 0;

networkMetaDefaults.meta.left = 0;
networkMetaDefaults.meta.neutral = 0;
networkMetaDefaults.meta.right = 0;
networkMetaDefaults.meta.none = 0;

networkMetaDefaults.meta.positive = 0;
networkMetaDefaults.meta.negative = 0;

NeuralNetworkTools.prototype.activate = function (params) {

  // params.user, .updateStats, .verbose

  return new Promise(async function(resolve, reject){

    try {

      if (networksHashMap.keys().length === 0) {
        console.log(chalkError("NNT | *** NO NETWORKS IN HASHMAP"));
        return reject(new Error("NNT | *** NO NETWORKS IN HASHMAP"));
      }

      const user = params.user;

      const verbose = configuration.verbose || params.verbose;

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

      const userHistograms = await mergeHistograms.merge({ histogramA: user.profileHistograms, histogramB: user.tweetHistograms });
      userHistograms.friends = await tcUtils.generateObjFromArray({ keys: user.friends, value: 1 }); // [ 1,2,3... ] => { 1:1, 2:1, 3:1, ... }

      const networkOutput = {};

      async.each(networksHashMap.keys(), async function(nnId){

        const networkObj = networksHashMap.get(nnId);

        if (!networkObj || (networkObj === undefined)){
          return reject(new Error("NNT | networkObj UNDEFINED | NN ID: " + nnId));
        }

        if (networkObj.inputsObj.inputs === undefined) {
          console.log(chalkError("NNT | UNDEFINED NETWORK INPUTS OBJ | NETWORK OBJ KEYS: " + Object.keys(networkObj)));
          return ("UNDEFINED NETWORK INPUTS OBJ");
        }


        try {

          const networkInputObj = await tcUtils.convertDatum({datum: user, inputsObj: networkObj.inputsObj, generateInputRaw: false});

          const outputRaw = networkObj.network.activate(networkInputObj.input);

          if (outputRaw.length !== 3) {
            console.log(chalkError("NNT | *** ZERO LENGTH NETWORK OUTPUT | " + nnId ));
            return("ZERO LENGTH NETWORK OUTPUT");
          }

          networkOutput[nnId] = {};
          networkOutput[nnId].outputRaw = [];
          networkOutput[nnId].outputRaw = outputRaw;
          networkOutput[nnId].output = [];
          networkOutput[nnId].categoryAuto = "none";
          networkOutput[nnId].matchFlag = false;

          const maxOutputIndex = await indexOfMax(outputRaw);

          switch (maxOutputIndex) {
            case 0:
              networkOutput[nnId].categoryAuto = "left";
              networkOutput[nnId].output = [1,0,0];
            break;
            case 1:
              networkOutput[nnId].categoryAuto = "neutral";
              networkOutput[nnId].output = [0,1,0];
            break;
            case 2:
              networkOutput[nnId].categoryAuto = "right";
              networkOutput[nnId].output = [0,0,1];
            break;
            default:
              networkOutput[nnId].categoryAuto = "none";
              networkOutput[nnId].output = [0,0,0];
          }

          networkOutput[nnId].matchFlag = (user.category && (user.category !== undefined) && (user.category !== "none") && (networkOutput[nnId].categoryAuto === user.category));

          if (verbose) {
            await printNetworkInput({
              title: networkObj.networkId
              + " | INPUT: " + networkObj.inputsId 
              + " | @" + user.screenName 
              + " | C: " + user.category 
              + " | A: " + networkOutput[nnId].categoryAuto
              + " | MATCH: " + networkOutput[nnId].matchFlag,
              inputsObj: networkInputObj
            });
          }

          return;

        }
        catch(err){
          console.log(chalkError("NNT | *** ERROR ACTIVATE NETWORK", err));
          return reject(err);
        }
      }, function(err){

        if (err) {
          console.log(chalkError("NNT | *** ACTIVATE NETWORK ERROR", err));
          return reject(err);
        }

        resolve({
          user: user,
          networkOutput: networkOutput
        });
        
      });
    }
    catch(err){

      console.log(chalkError("NNT | *** ACTIVATE NETWORK ERROR", err));
      reject(err);
    }

  });
};

module.exports = NeuralNetworkTools;
