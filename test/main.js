
const fsp = require('fs').promises;
const path = require("path");
const async = require("async");
const randomItem = require("random-item");

const mongoose = require("mongoose");
mongoose.set("useFindAndModify", false);

const tcuChildName = Number("NNT_TEST_TCU");
const ThreeceeUtilities = require("@threeceelabs/threecee-utilities");
const tcUtils = new ThreeceeUtilities(tcuChildName);

const jsonPrint = tcUtils.jsonPrint;

const test_user_tobi = require("./test_user_tobi.json");
const test_user_hector = require("./test_user_hector.json");

const testUsersArray = [];
testUsersArray.push(test_user_tobi);
testUsersArray.push(test_user_hector);

const NeuralNetworkTools = require("../index.js");
const nnTools = new NeuralNetworkTools("TEST");

const maxNormObj = require("./maxInputHashMap.json");

function loadUsers(usersFolder){
  return new Promise(function(resolve, reject){

    const userArray = [];

    // const usersFileArray = await fsp.readdir(usersFolder);
    fsp.readdir(usersFolder)
    .then(function(usersFileArray){

      async.eachSeries(usersFileArray, function(file, cb){

        if (file.startsWith("user_") && file.endsWith(".json")) {
          const userId = file.replace(".json", "");
          console.log("USER LOAD: " + file);
          const user = require("./users/" + userId + ".json");
          userArray.push(user);
          cb();
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

    const networkIdArray = [];
    
    fsp.readdir(networksFolder)
    .then(function(nnFileArray){
      async.eachSeries(nnFileArray, function(file, cb){
        if (file.endsWith(".json") && !file.includes("bestRuntimeNetwork")) {

          const nnId = file.replace(".json", "");
          const nn = require("./networks/" + nnId + ".json");

          networkIdArray.push(nnId);

          nnTools.loadNetwork({networkObj: nn})
          .then(function(){
            cb();
          })
          .catch(function(err){
            cb(err);
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

function activateUsers(userArray){

  return new Promise(function(resolve, reject){

    async.eachSeries(userArray, function(user, cb){

      nnTools.activate({user: user, verbose: false})
      .then(function(noutObj){

        nnTools.updateNetworkStats({user: noutObj.user, networkOutput: noutObj.networkOutput})
        .then(function(networkStats){

          nnTools.printNetworkResults()
          .then(function(){
            cb();
          })
          .catch(function(e){
            cb(er);
          });

        })
        .catch(function(err){
          console.log("NNT | ERROR: " + err);
          return cb(err);
        });

      })
      .catch(function(err){
        return cb(err);
      });
    }, function(err){
      if (err) { return reject(err); }
      resolve();
    });

  });
}

async function main(){

    await nnTools.setMaxInputHashMap(maxNormObj.maxInputHashMap);
    await nnTools.setNormalization(maxNormObj.normalization);

    const networksFolder = path.join(__dirname, "networks");
    const networkIdArray = await loadNetworks(networksFolder);

    const randomNnId = randomItem(networkIdArray);
    console.log("setPrimaryNeuralNetwork: " + randomNnId);
    await nnTools.setPrimaryNeuralNetwork(randomNnId);

    const usersFolder = path.join(__dirname, "users");
    const userArray = await loadUsers(usersFolder);

    console.log("userArray.length: " + userArray.length);

    await activateUsers(userArray);

    const statsObj = await nnTools.getNetworkStats();
    console.log("statsObj\n" + jsonPrint(statsObj));
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
