/*jslint node: true */
/*jshint sub:true*/

const neataptic = require("neataptic");
const carrot = require("@liquid-carrot/carrot");

const networkTechnology = "neataptic";

const async = require("async");
const util = require("util");
const defaults = require("object.defaults");
const EventEmitter = require("events");
const MergeHistograms = require("@threeceelabs/mergehistograms");
const mergeHistograms = new MergeHistograms();
const HashMap = require("hashmap").HashMap;
const deepcopy = require("deep-copy");

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
  return new Promise(function(resolve, reject){
    tcUtils.setMaxInputHashMap(m);
    console.log(chalkAlert("NNT | --> SET MAX INPUT HASHMAP: " + Object.keys(tcUtils.getMaxInputHashMap())));
    resolve();
  });
}

NeuralNetworkTools.prototype.getMaxInputHashMap = function(){
  return tcUtils.getMaxInputHashMap();
}

NeuralNetworkTools.prototype.setNormalization = function(n){
  return new Promise(function(resolve, reject){
    tcUtils.setNormalization(n);
    console.log(chalkAlert("NNT | --> SET NORMALIZATION\n" + jsonPrint(tcUtils.getNormalization())));
    resolve();
  });
}

NeuralNetworkTools.prototype.getNormalization = function(){
  const normalization = tcUtils.getNormalization();
  return normalization;
}

NeuralNetworkTools.prototype.loadNetwork = function(params){

  return new Promise(function(resolve, reject){

    if (!params.networkObj || params.networkObj === undefined || params.networkObj.network === undefined) {
      console.log(chalkError("NNT | *** LOAD NETWORK UNDEFINED: " + params.networkObj));
      return reject(new Error("NNT | LOAD NETWORK UNDEFINED"));
    }

    const nnObj = deepcopy(params.networkObj);

    const network = neataptic.Network.fromJSON(nnObj.network);

    nnObj.network = network;

    networksHashMap.set(nnObj.networkId, nnObj);

    console.log(chalkAlert("NNT | --> LOAD NN: " + nnObj.networkId));

    resolve(nnObj.networkId);

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

    console.log(chalkAlert("NNT | --> SET PRIMARY NN: " + primaryNeuralNetworkId));

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

const arrayOfArrays = [];
let nnIdArray = [];
let currentBestNetwork;

NeuralNetworkTools.prototype.generateNetworksOutput = function (params){

  return new Promise(function(resolve, reject){

    const networkOutput = params.networkOutput;
    const expectedOutput = params.expectedOutput;

    arrayOfArrays.length = 0;

    nnIdArray = Object.keys(networkOutput);

    async.eachOf(nnIdArray, function(nnId, index, cb){

      arrayOfArrays[index] = networkOutput[nnId].output;

      const nnOutput = networkOutput[nnId].output;
      const nn = networksHashMap.get(nnId);

      if (!nn || nn === undefined) {
        return reject(new Error("NNT | generateNetworksOutput NN UNDEFINED"));
      }

      if (statsObj.loadedNetworks[nnId] === undefined) {
        console.log(chalkAlert("INIT statsObj.loadNetworks " + nnId));
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
      }

      if (statsObj.allTimeLoadedNetworks[nnId] === undefined) {
        console.log(chalkAlert("INIT statsObj.allTimeLoadedNetworks " + nnId));
        statsObj.allTimeLoadedNetworks[nnId] = {};
        statsObj.allTimeLoadedNetworks[nnId].networkId = nnId;
        statsObj.allTimeLoadedNetworks[nnId].inputsId = nn.inputsId;
        statsObj.allTimeLoadedNetworks[nnId].numInputs = nn.numInputs;
        statsObj.allTimeLoadedNetworks[nnId].successRate = nn.successRate;
        statsObj.allTimeLoadedNetworks[nnId].overallMatchRate = nn.overallMatchRate;
      }

      statsObj.loadedNetworks[nnId].output = nnOutput;

      if (expectedOutput[0] === 1 || expectedOutput[1] === 1 || expectedOutput[2] === 1) {

        statsObj.loadedNetworks[nnId].total += 1;
        nn.total = statsObj.loadedNetworks[nnId].total;

        if ((nnOutput[0] === expectedOutput[0])
          && (nnOutput[1] === expectedOutput[1])
          && (nnOutput[2] === expectedOutput[2])){

          statsObj.loadedNetworks[nnId].match += 1;
          statsObj.loadedNetworks[nnId].matchFlag = true;
          nn.match = statsObj.loadedNetworks[nnId].match;

        }
        else {
          statsObj.loadedNetworks[nnId].mismatch += 1;
          statsObj.loadedNetworks[nnId].matchFlag = false;
        }

        statsObj.loadedNetworks[nnId].matchRate = 100.0 * statsObj.loadedNetworks[nnId].match / statsObj.loadedNetworks[nnId].total;

        nn.matchRate = statsObj.loadedNetworks[nnId].matchRate;
        
      }
      else {
        statsObj.loadedNetworks[nnId].matchFlag = "---";
      }

      if ((currentBestNetwork.matchRate === undefined) || (nn.matchRate > currentBestNetwork.matchRate)){
        console.log("NNT | +++ NET BEST NETWORK | " + nn.matchRate.toFixed(2) + " | " + nn.networkId);
        currentBestNetwork = deepcopy(nn);
      }

      networksHashMap.set(nnId, nn);

      cb();

    }, async function(){

      try {
        resolve(currentBestNetwork);
      }
      catch(err){
        console.trace(chalkError("NNT | *** generateNetworksOutput ERROR: " + err));
        reject(err);
      }

    });

  });
}

const networkOutputDefaults = {};

networkOutputDefaults.output = [];
networkOutputDefaults.left = 0;
networkOutputDefaults.neutral = 0;
networkOutputDefaults.right = 0;
networkOutputDefaults.none = 0;
networkOutputDefaults.positive = 0;
networkOutputDefaults.negative = 0;

NeuralNetworkTools.prototype.activate = function (params) {

  // params.user

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

        // console.log("ACTIVATE NN " + networkObj.networkId);

        if (statsObj.loadedNetworks[nnId] === undefined){
          statsObj.loadedNetworks[nnId] = {};
        }

        statsObj.loadedNetworks[nnId] = defaults(statsObj.loadedNetworks[nnId], networkOutputDefaults);

        networkOutput[nnId] = {};
        networkOutput[nnId].output = [];
        networkOutput[nnId].left = statsObj.loadedNetworks[nnId].left;
        networkOutput[nnId].neutral = statsObj.loadedNetworks[nnId].neutral;
        networkOutput[nnId].right = statsObj.loadedNetworks[nnId].right;
        networkOutput[nnId].none = statsObj.loadedNetworks[nnId].none;
        networkOutput[nnId].positive = statsObj.loadedNetworks[nnId].positive;
        networkOutput[nnId].negative = statsObj.loadedNetworks[nnId].negative;

        if (networkObj.inputsObj.inputs === undefined) {
          console.log(chalkError("NNT | UNDEFINED NETWORK INPUTS OBJ | NETWORK OBJ KEYS: " + Object.keys(networkObj)));
          return ("UNDEFINED NETWORK INPUTS OBJ");
        }

        try {

          const networkInputObj = await tcUtils.convertDatum({datum: user, inputsObj: networkObj.inputsObj, generateInputRaw: false});

          const output = networkObj.network.activate(networkInputObj.input);

          if (output.length !== 3) {
            console.log(chalkError("NNT | *** ZERO LENGTH NETWORK OUTPUT | " + nnId ));
            return("ZERO LENGTH NETWORK OUTPUT");
          }

          const maxOutputIndex = await indexOfMax(output);

          let categoryAuto;

          switch (maxOutputIndex) {
            case 0:
              categoryAuto = "left";
              networkOutput[nnId].output = [1,0,0];
              networkOutput[nnId].left += 1;
            break;
            case 1:
              categoryAuto = "neutral";
              networkOutput[nnId].output = [0,1,0];
              networkOutput[nnId].neutral += 1;
            break;
            case 2:
              categoryAuto = "right";
              networkOutput[nnId].output = [0,0,1];
              networkOutput[nnId].right += 1;
            break;
            default:
              categoryAuto = "none";
              networkOutput[nnId].output = [0,0,0];
              networkOutput[nnId].none += 1;
          }

          const match = (categoryAuto === user.category) ? "MATCH" : "MISS";
          networkOutput[nnId].match = (categoryAuto === user.category);

          if (verbose) {
            await printNetworkInput({
              title: networkObj.networkId
              + " | INPUT: " + networkObj.inputsId 
              + " | @" + user.screenName 
              + " | C: " + user.category 
              + " | A: " + categoryAuto
              + " | MATCH: " + match,
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
