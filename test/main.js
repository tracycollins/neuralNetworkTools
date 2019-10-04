const BINARY_MODE = true;
const CONVERT_DATUM = true;

const fsp = require('fs').promises;
const path = require("path");
const async = require("async");
const randomItem = require("random-item");

const mongoose = require("mongoose");
mongoose.set("useFindAndModify", false);

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

if (hostname === "google") {
  DROPBOX_ROOT_FOLDER = "/home/tc/Dropbox/Apps/wordAssociation";
}
else {
  DROPBOX_ROOT_FOLDER = "/Users/tc/Dropbox/Apps/wordAssociation";
}

const configHostFolder = path.join(DROPBOX_ROOT_FOLDER, "config/utility",hostname);

const tcuChildName = Number("NNT_TEST_TCU");
const ThreeceeUtilities = require("@threeceelabs/threecee-utilities");
const tcUtils = new ThreeceeUtilities(tcuChildName);

const jsonPrint = tcUtils.jsonPrint;

const testNetworkFolder = path.join(configHostFolder, "test/testData/networks");
const testUserFolder = path.join(configHostFolder, "test/testData/user/converted");

const test_user_tobi = tcUtils.loadFileRetry({folder: testUserFolder, file: "user_10032112.json"});
const test_user_hector = tcUtils.loadFileRetry({folder: testUserFolder, file: "user_10069612.json"});

const testInputsFolder = path.join(configHostFolder, "test/testData/inputs");

const testUsersArray = [];
testUsersArray.push(test_user_tobi);
testUsersArray.push(test_user_hector);

const NeuralNetworkTools = require("../index.js");
const nnTools = new NeuralNetworkTools("TEST");


function loadUsers(usersFolder){
  return new Promise(function(resolve, reject){

    const userArray = [];

    fsp.readdir(usersFolder)
    .then(function(usersFileArray){

      async.eachSeries(usersFileArray, function(file, cb){

        if (file.startsWith("user_") && file.endsWith(".json")) {
          console.log("USER LOAD: " + file);

          tcUtils.loadFileRetry({folder: testUserFolder, file: file})
          .then(function(user){
            userArray.push(user);
            cb();
          })
          .catch(function(e){
            cb(e);
          });
        }
        else{
          console.log("... SKIPPING USER LOAD: " + file);
          cb();
        }

      }, function(err){
        if (err) { return reject(err); }
        console.log("FOUND " + userArray.length + " USERS IN " + usersFolder);
        resolve(userArray);
      });

    })
    .catch(function(err){
      return reject(err);
    });

  });
}

function loadInputs(inputsFolder){
  return new Promise(function(resolve, reject){

    console.log("... LOADING INPUTS | " + inputsFolder);

    const inputsIdArray = [];
    
    fsp.readdir(inputsFolder)
    .then(function(inputsFileArray){

      async.eachSeries(inputsFileArray, function(file, cb){

        if (file.startsWith("inputs_") && file.endsWith(".json")) {

          const inputsId = file.replace(".json", "");

          tcUtils.loadFileRetry({folder: inputsFolder, file: file})
          .then(function(inputsObj){

            inputsIdArray.push(inputsId);

            nnTools.loadInputs({inputsObj: inputsObj})
            .then(function(){
              cb();
            })
            .catch(function(err){
              cb(err);
            });

          })
          .catch(function(e){
            cb(e);
          });

        }
        else{
          console.log("... SKIPPING INPUTS LOAD: " + file);
          cb();
        }
      }, async function(err){
        if (err) { return reject(err); }
        console.log("LOADED " + inputsIdArray.length + " INPUTS FROM " + inputsFolder);
        resolve(inputsIdArray);
      });
    })
    .catch(function(err){
      return reject(err);
    });

  });
}

function loadNetworks(networksFolder){
  return new Promise(function(resolve, reject){

    console.log("... LOADING NETWORKS | " + networksFolder);

    const networkIdArray = [];
    
    fsp.readdir(networksFolder)
    .then(function(nnFileArray){
      async.eachSeries(nnFileArray, function(file, cb){
        if (file.endsWith(".json") && !file.includes("bestRuntimeNetwork")) {

          const nnId = file.replace(".json", "");

          tcUtils.loadFileRetry({folder: networksFolder, file: file})
          .then(function(nn){

            networkIdArray.push(nnId);

            nnTools.loadNetwork({networkObj: nn})
            .then(function(){
              cb();
            })
            .catch(function(err){
              console.log("LOAD NN ERROR: " + err);
              cb();
            });

          })
          .catch(function(e){
            cb(e);
          });

        }
        else{
          console.log("... SKIPPING NETWORK LOAD: " + file);
          cb();
        }
      }, async function(err){
        if (err) { return reject(err); }
        console.log("LOADED " + nnTools.getNumberNetworks() + " NETWORKS FROM " + networksFolder);
        resolve(networkIdArray);
      });
    })
    .catch(function(err){
      return reject(err);
    });

  });
}

function getNetworks(networkIdArray){
  return new Promise(function(resolve, reject){

    console.log("... GETTING NETWORKS | " + networkIdArray.length);
    
    async.eachSeries(networkIdArray, function(nnId, cb){

      nnTools.getNetwork({networkId: nnId})
      .then(function(nnObj){
        cb();
      })
      .catch(function(err){
        cb(err);
      });

    }, function(err){
      if (err) { return reject(err); }
      console.log("GOT " + nnTools.getNumberNetworks() + " NETWORKS");
      resolve();
    });

  });
}

function convertDatum(params){
  return new Promise(function(resolve, reject){

    tcUtils.convertDatumOneNetwork({primaryInputsFlag: true, user: params.user, binaryMode: params.binaryMode}).
    then(function(results){

      if (results.emptyFlag) {
        console.error("!!! EMPTY CONVERTED DATUM ... SKIPPING | @" + params.user.screenName);
        return reject(new Error("EMPTY CONVERTED DATUM"));
      }

      for(const inputValue of results.datum.input){
        if (typeof inputValue != "number") {
          return reject(new Error("INPUT VALUE NOT TYPE NUMBER | @" + results.datum.screenName + " | INPUT TYPE: " + typeof inputValue));
        }
        if (inputValue < 0) {
          return reject(new Error("INPUT VALUE LESS THAN ZERO | @" + results.datum.screenName + " | INPUT: " + inputValue));
        }
        if (inputValue > 1) {
          return reject(new Error("INPUT VALUE GREATER THAN ONE | @" + results.datum.screenName + " | INPUT: " + inputValue));
        }
      }

      for(const outputValue of results.datum.output){
        if (typeof outputValue != "number") {
          return reject(new Error("OUTPUT VALUE NOT TYPE NUMBER | @" + results.datum.screenName + " | OUTPUT TYPE: " + typeof outputValue));
        }
        if (outputValue < 0) {
          return reject(new Error("OUTPUT VALUE LESS THAN ZERO | @" + results.datum.screenName + " | OUTPUT: " + outputValue));
        }
        if (outputValue > 1) {
          return reject(new Error("OUTPUT VALUE GREATER THAN ONE | @" + results.datum.screenName + " | OUTPUT: " + outputValue));
        }
      }

      const datum = {input: results.datum.input, output: results.datum.output};

      resolve(datum);
    }).
    catch(function(err){
      console.error("*** ERROR convertDatumOneNetwork: " + err);
      return reject(err);
    });
  });
}

async function activateUsers(primaryNetworkId, userArray, binaryMode, convertDatumFlag){
  for(const user of userArray) {

    let params = {};

    if (convertDatumFlag){
      params = {user: user, convertDatumFlag: true, binaryMode: binaryMode, verbose: false};
    }
    else{
      params.datum = await convertDatum({user: user, binaryMode: binaryMode});
      params.user = {};
      params.user.nodeId = user.nodeId;
      params.user.screenName = user.screenName;
      params.user.category = user.category;
      params.user.categoryAuto = user.categoryAuto;
      params.convertDatumFlag = false;
      params.binaryMode = binaryMode;
      params.verbose = false;
    }

    const noutObj = await nnTools.activate(params);

    const networkStats = await nnTools.updateNetworkStats({user: noutObj.user, networkOutput: noutObj.networkOutput})

    const title = "BEST | " + networkStats.networkId
      + " | BIN: " + binaryMode 
      + " | IHR: " + noutObj.networkOutput[networkStats.networkId].inputHitRate.toFixed(3) + "%"
      + " | M/MM/TOT: " + networkStats.meta.match + "/" + networkStats.meta.mismatch + "/" + networkStats.meta.total
      + " | MR: " + networkStats.matchRate.toFixed(2) + "%"
      + " | MTCH: " + networkStats.meta.matchFlag
      + " | C M: " + networkStats.meta.category + " A: " + networkStats.meta.categoryAuto
      + " | @" + noutObj.user.screenName;

    await nnTools.printNetworkResults({title: title});
  }
  return;
}

async function main(){

    console.log("LOAD maxInputHashMap: " + testInputsFolder + "/maxInputHashMap.json");
    const maxNormObj = await tcUtils.loadFileRetry({folder: testInputsFolder, file: "maxInputHashMap.json"});

    await nnTools.setMaxInputHashMap(maxNormObj.maxInputHashMap);
    await nnTools.setNormalization(maxNormObj.normalization);

    const inputsIdArray = await loadInputs(testInputsFolder);
    console.log("inputsIdArray.length: " + inputsIdArray.length);

    const networkIdArray = await loadNetworks(testNetworkFolder);

    const randomNnId = randomItem(networkIdArray);
    console.log("setPrimaryNeuralNetwork: " + randomNnId);
    await nnTools.setPrimaryNeuralNetwork(randomNnId);

    const userArray = await loadUsers(testUserFolder);

    console.log("userArray.length: " + userArray.length);

    await activateUsers(randomNnId, userArray, BINARY_MODE, CONVERT_DATUM);

    const statsObj = await nnTools.getNetworkStats();
    console.log("statsObj.bestNetwork\n" + jsonPrint(statsObj.bestNetwork));
    console.log("statsObj.currentBestNetwork\n" + jsonPrint(statsObj.currentBestNetwork));

    await getNetworks(networkIdArray);
    return;
}

main()
.then(function(){
  console.log("NNT | DONE");
  process.exit();
})
.catch(function(err){
  console.log("NNT | *** TEST ACTIVATE setPrimaryNeuralNetwork ERROR: " + err);
  process.exit();
});
