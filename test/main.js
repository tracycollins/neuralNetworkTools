const BINARY_MODE = true;
const USER_PROFILE_ONLY_FLAG = true;

const MODULE_ID_PREFIX = "NNT";
const fsp = require('fs').promises;
const path = require("path");
const chalk = require("chalk");
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

const async = require("async");
const randomItem = require("random-item");

const os = require("os");
let hostname = os.hostname();
hostname = hostname.replace(/\.example\.com/g, "");
hostname = hostname.replace(/\.local/g, "");
hostname = hostname.replace(/\.home/g, "");
hostname = hostname.replace(/\.at\.net/g, "");
hostname = hostname.replace(/\.fios-router\.home/g, "");
hostname = hostname.replace(/word0-instance-1/g, "google");
hostname = hostname.replace(/word/g, "google");

const wordAssoDb = require("@threeceelabs/mongoose-twitter");

let DROPBOX_ROOT_FOLDER;

if (hostname === "google") {
  DROPBOX_ROOT_FOLDER = "/home/tc/Dropbox/Apps/wordAssociation";
}
else {
  DROPBOX_ROOT_FOLDER = "/Users/tc/Dropbox/Apps/wordAssociation";
}

const configDefaultTestFolder = path.join(DROPBOX_ROOT_FOLDER, "config/utility/test/testData");
const configHostFolder = path.join(DROPBOX_ROOT_FOLDER, "config/utility",hostname);

const tcuChildName = Number("NNT_TEST_TCU");
const ThreeceeUtilities = require("@threeceelabs/threecee-utilities");
const tcUtils = new ThreeceeUtilities(tcuChildName);

const jsonPrint = tcUtils.jsonPrint;

const testNetworkFolder = path.join(configDefaultTestFolder, "networks");
const testUserFolder = path.join(configDefaultTestFolder, "users/fromTrainingSet");

// const test_user_tobi = tcUtils.loadFile({folder: testUserFolder, file: "user_10032112.json"});
// const test_user_hector = tcUtils.loadFile({folder: testUserFolder, file: "user_10069612.json"});

const testInputsFolder = path.join(configDefaultTestFolder, "inputs");

const testUsersArray = [];
// testUsersArray.push(test_user_tobi);
// testUsersArray.push(test_user_hector);

const NeuralNetworkTools = require("../index.js");
const nnTools = new NeuralNetworkTools("TEST");

async function connectDb(){

  try {

    console.log(chalkBlueBold(MODULE_ID_PREFIX + " | CONNECT MONGO DB ..."));

    const db = await wordAssoDb.connect(MODULE_ID_PREFIX + "_" + process.pid);

    db.on("error", async function(err){
      console.log(chalkError(MODULE_ID_PREFIX + " | *** MONGO DB CONNECTION ERROR"));
      db.close();
    });

    db.on("close", async function(err){
      console.log(chalkError(MODULE_ID_PREFIX + " | *** MONGO DB CONNECTION CLOSED"));
    });

    db.on("disconnected", async function(){
      console.log(chalkAlert(MODULE_ID_PREFIX + " | *** MONGO DB DISCONNECTED"));
    });

    console.log(chalk.green(MODULE_ID_PREFIX + " | MONGOOSE DEFAULT CONNECTION OPEN"));

    return db;
  }
  catch(err){
    console.log(chalkError(MODULE_ID_PREFIX + " | *** MONGO DB CONNECT ERROR: " + err));
    throw err;
  }
}

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

async function loadNetworksDb(){
  console.log("... LOADING DB NETWORKS");
  try{
    const networkIdArray = [];

    const nnDocArray = await wordAssoDb.NeuralNetwork.find({
      networkTechnology: "carrot",
      successRate: {"$gt": 90},
      "createdAt": {"$gt": new Date("2019-12-01T00:00:00.000Z")}
    });
    console.log(chalkInfo(MODULE_ID_PREFIX + " | LOADED NETWORKS: " + nnDocArray.length));

    for(const nnDoc of nnDocArray){
      networkIdArray.push(nnDoc.networkId);

      const nn = nnDoc.toObject();

      await nnTools.loadNetwork({networkObj: nn});
    }

    return networkIdArray;
  }
  catch(err){
    console.log(chalkError(MODULE_ID_PREFIX + " | *** LOAD DB NETWORKS ERROR: " + err));
    throw err;
  }
}

function loadNetworks(networksFolder){
  return new Promise(function(resolve, reject){

    console.log("... LOADING FILE NETWORKS | " + testNetworkFolder);

    const networkIdArray = [];
    
    fsp.readdir(networksFolder)
    .then(function(nnFileArray){
      async.eachSeries(nnFileArray, function(file, cb){
        if (file.endsWith(".json") && !file.includes("bestRuntimeNetwork")) {

          const nnId = file.replace(".json", "");

          tcUtils.loadFile({folder: testNetworkFolder, file: file})
          .then(function(nn){

            if (!nn || nn === undefined) {
              console.log(chalkError("NN NOT FOUND: " + file));
            }

            if (nn.networkTechnology !== "carrot"){
              console.log("... SKIPPING NETWORK LOAD (NOT CARROT): " + nn.networkId);
              return cb();
            }

            networkIdArray.push(nnId);

            nnTools.loadNetwork({networkObj: nn})
            .then(function(){
              cb();
            })
            .catch(function(err){
              console.log(jsonPrint(err));
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

      nnTools.activate({user: user, userProfileOnlyFlag: USER_PROFILE_ONLY_FLAG, binaryMode: binaryMode, convertDatumFlag: true, verbose: false})
      .then(function(noutObj){

        // noutObj = { user: user, networkOutput: networkOutput }

        nnTools.updateNetworkStats({user: noutObj.user, networkOutput: noutObj.networkOutput})
        .then(function(networkStats){

          const title = "BEST | " + networkStats.networkId
            + " | PROFILE ONLY: " + USER_PROFILE_ONLY_FLAG 
            + " | BIN: " + binaryMode 
            + " | CAT M: " + networkStats.meta.category.charAt(0).toUpperCase()
            + " A: " + networkStats.meta.categoryAuto.charAt(0).toUpperCase()
            + " | IHR: " + noutObj.networkOutput[networkStats.networkId].inputHitRate.toFixed(3) + "%"
            + " | M/MM/TOT: " + networkStats.meta.match + "/" + networkStats.meta.mismatch + "/" + networkStats.meta.total
            + " | MR: " + networkStats.matchRate.toFixed(3) + "%"
            + " | MATCH: " + networkStats.meta.matchFlag
            + " | @" + noutObj.user.screenName;

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

  await connectDb();

  console.log("LOAD maxInputHashMap: " + testInputsFolder + "/maxInputHashMap.json");
  const maxNormObj = await tcUtils.loadFileRetry({folder: testInputsFolder, file: "maxInputHashMap.json"});
  await nnTools.setMaxInputHashMap(maxNormObj.maxInputHashMap);
  await nnTools.setNormalization(maxNormObj.normalization);

  // const networkIdArray = await loadNetworks(testNetworkFolder);
  const networkIdArray = await loadNetworksDb();

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
