const BINARY_MODE = true;

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

// const configDefaultFolder = path.join(DROPBOX_ROOT_FOLDER, "config/utility/default");
const configHostFolder = path.join(DROPBOX_ROOT_FOLDER, "config/utility",hostname);

const tcuChildName = Number("NNT_TEST_TCU");
const ThreeceeUtilities = require("@threeceelabs/threecee-utilities");
const tcUtils = new ThreeceeUtilities(tcuChildName);

const jsonPrint = tcUtils.jsonPrint;

const testNetworkFolder = path.join(configHostFolder, "test/testData/networks");
const testUserFolder = path.join(configHostFolder, "test/testData/user/converted");

const test_user_tobi = tcUtils.loadFile({folder: testUserFolder, file: "user_10032112.json"});
const test_user_hector = tcUtils.loadFile({folder: testUserFolder, file: "user_10069612.json"});

const testInputsFolder = path.join(configHostFolder, "test/testData/inputs");

const testUsersArray = [];
testUsersArray.push(test_user_tobi);
testUsersArray.push(test_user_hector);

const NeuralNetworkTools = require("../index.js");
const nnTools = new NeuralNetworkTools("TEST");


function loadUsers(usersFolder){
  return new Promise(function(resolve, reject){

    const userArray = [];

    // const usersFileArray = await fsp.readdir(usersFolder);
    fsp.readdir(usersFolder)
    .then(function(usersFileArray){

      async.eachSeries(usersFileArray, function(file, cb){

        if (file.startsWith("user_") && file.endsWith(".json")) {
          // const userId = file.replace(".json", "");
          console.log("USER LOAD: " + file);

          tcUtils.loadFile({folder: testUserFolder, file: file})
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

function loadNetworks(networksFolder){
  return new Promise(function(resolve, reject){

    console.log("... LOADING NETWORKS | " + testNetworkFolder);

    const networkIdArray = [];
    
    fsp.readdir(networksFolder)
    .then(function(nnFileArray){
      async.eachSeries(nnFileArray, function(file, cb){
        if (file.endsWith(".json") && !file.includes("bestRuntimeNetwork")) {

          const nnId = file.replace(".json", "");

          tcUtils.loadFile({folder: testNetworkFolder, file: file})
          .then(function(nn){

            networkIdArray.push(nnId);

            nnTools.loadNetwork({networkObj: nn})
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
          console.log("... SKIPPING NETWORK LOAD: " + file);
          cb();
        }
      }, async function(err){
        if (err) { return reject(err); }
        console.log("FOUND " + nnTools.getNumberNetworks() + " NETWORKS IN " + networksFolder);
        resolve(networkIdArray);
      });
    })
    .catch(function(err){
      return reject(err);
    });

  });
}

function activateUsers(primaryNetworkId, userArray, binaryMode){

  return new Promise(function(resolve, reject){

    async.eachSeries(userArray, function(user, cb){

      nnTools.activate({user: user, binaryMode: binaryMode, verbose: false})
      .then(function(noutObj){

        // noutObj = { user: user, networkOutput: networkOutput }

        nnTools.updateNetworkStats({user: noutObj.user, networkOutput: noutObj.networkOutput})
        .then(function(networkStats){

          const title = "BEST | " + networkStats.networkId
            + " | @" + noutObj.user.screenName 
            + "\nBIN MODE: " + binaryMode 
            + " | C M: " + networkStats.meta.category 
            + " A: " + networkStats.meta.categoryAuto
            + " | INPUT HIT RATE: " + noutObj.networkOutput[networkStats.networkId].inputHitRate.toFixed(3) + "%"
            + " | M/MM/TOT: " + networkStats.meta.match + "/" + networkStats.meta.mismatch + "/" + networkStats.meta.total
            + " | MR: " + networkStats.matchRate.toFixed(3) + "%"
            + " | MATCH: " + networkStats.meta.matchFlag;

          nnTools.printNetworkResults({title: title})
          .then(function(){
            cb();
          })
          .catch(function(e){
            cb(e);
          });

        })
        .catch(function(err){
          console.log("NNT | ERROR: " + err);
          cb();
          // return cb(err);
        });

      })
      .catch(async function(err){
        console.log("NN *** ACTIVATE ERROR: " + err);
        if (err.message.includes("ACTIVATE_UNDEFINED")){
          const errParts = err.message.split(":");
          const errNnId = errParts[1].trim();
          console.log("ERR NN ID: " + errNnId);
          await nnTools.deleteNetwork({networkId: errNnId});
          return cb();
        }
        else {
          return cb(err);
        }
      });
    }, function(err){
      if (err) { return reject(err); }
      resolve();
    });

  });
}

async function main(){

    console.log("LOAD maxInputHashMap: " + testInputsFolder + "/maxInputHashMap.json");
    const maxNormObj = await tcUtils.loadFileRetry({folder: testInputsFolder, file: "maxInputHashMap.json"});
    await nnTools.setMaxInputHashMap(maxNormObj.maxInputHashMap);
    await nnTools.setNormalization(maxNormObj.normalization);

    const networkIdArray = await loadNetworks(testNetworkFolder);

    const randomNnId = randomItem(networkIdArray);
    console.log("setPrimaryNeuralNetwork: " + randomNnId);
    await nnTools.setPrimaryNeuralNetwork(randomNnId);

    const userArray = await loadUsers(testUserFolder);

    console.log("userArray.length: " + userArray.length);

    await activateUsers(randomNnId, userArray, BINARY_MODE);

    const statsObj = await nnTools.getNetworkStats();
    console.log("statsObj.bestNetwork\n" + jsonPrint(statsObj.bestNetwork));
    console.log("statsObj.currentBestNetwork\n" + jsonPrint(statsObj.currentBestNetwork));
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
