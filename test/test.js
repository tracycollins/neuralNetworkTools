
const fsp = require('fs').promises;
const path = require("path");
const async = require("async");
const should = require("should");
const assert = require("assert");
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

const configDefaultFolder = path.join(DROPBOX_ROOT_FOLDER, "config/utility/default");
const configHostFolder = path.join(DROPBOX_ROOT_FOLDER, "config/utility",hostname);

const tcuChildName = Number("NNT_TEST_TCU");
const ThreeceeUtilities = require("@threeceelabs/threecee-utilities");
const tcUtils = new ThreeceeUtilities(tcuChildName);

const jsonPrint = tcUtils.jsonPrint;

const testUserFolder = path.join(configHostFolder, "test/testData/user/converted");

// const test_user_tobi = require("./test_user_tobi.json");
const test_user_tobi = tcUtils.loadFile({folder: testUserFolder, file:"user_10032112.json"});
const test_user_hector = require("./test_user_hector.json");

const testUsersArray = [];
testUsersArray.push(test_user_tobi);
testUsersArray.push(test_user_hector);

const NeuralNetworkTools = require("../index.js");
const nnTools = new NeuralNetworkTools("TEST");

const dbOptions = { 
  useNewUrlParser: true,
  keepAlive: 120,
  autoReconnect: true,
  autoIndex: false,
  reconnectTries: Number.MAX_VALUE,
  socketTimeoutMS: 90000,
  connectTimeoutMS: 0,
  poolSize: 100
};

// mongoose.connect("mongodb://localhost/test", dbOptions);

// const db = mongoose.connection;

// global.globalDbConnection = db;

const maxNormObj = require("./maxInputHashMap.json");

function loadUsers(usersFolder){
  return new Promise(async function(resolve, reject){
    try{
      const userArray = [];
      const usersFileArray = await fsp.readdir(usersFolder);
      async.eachSeries(usersFileArray, async function(file){
        if (file.startsWith("user_") && file.endsWith(".json")) {
          const userId = file.replace(".json", "");
          console.log("USER LOAD: " + file);
          const user = require("./users/" + userId + ".json");
          userArray.push(user);
        }
        else{
          console.log("... SKIPPING USER LOAD: " + file);
        }
        return;
      }, function(err){
        should.not.exist(err);
        console.log("FOUND " + userArray.length + " USERS IN " + usersFolder);
        resolve(userArray);
      });
    }
    catch(err){
      return reject(err);
    }
  });
}

function loadNetworks(networksFolder){
  return new Promise(async function(resolve, reject){
    try{
      const networkIdArray = [];
      const nnFileArray = await fsp.readdir(networksFolder);
      async.eachSeries(nnFileArray, async function(file){
        if (file.endsWith(".json") && !file.includes("bestRuntimeNetwork")) {

          const nnId = file.replace(".json", "");
          const nn = require("./networks/" + nnId + ".json");

          networkIdArray.push(nnId);

          nnTools.loadNetwork({networkObj: nn})
          .then(function(){
            return;
          })
          .catch(function(err){
            should.not.exist(err);
          });

        }
        else{
          console.log("... SKIPPING NETWORK LOAD: " + file);
        }
        return;
      }, async function(err){
        should.not.exist(err);
        console.log("FOUND " + nnTools.getNumberNetworks() + " NETWORKS IN " + networksFolder);
        resolve(networkIdArray);
      });
    }
    catch(err){
      return reject(err);
    }
  });
}

let currentBestNetworkStats;

function activateUsers(userArray){

  return new Promise(function(resolve, reject){

    const activateUsersPromiseArray = [];

    userArray.forEach(function(user){

      console.log("NNT | user @" + user.screenName);

      activateUsersPromiseArray.push(nnTools.activate({user: user, verbose: false}));
    });

    Promise.all(activateUsersPromiseArray)
    .then(function(activateOutputArray){

      const primaryNetworkId = nnTools.getPrimaryNeuralNetwork();

      console.log("PRIMARY ID: " + primaryNetworkId)

      async.eachSeries(activateOutputArray, function(noutObj, cb){

        console.log("noutObj.networkOutput\n" + jsonPrint(noutObj.networkOutput));

        nnTools.updateNetworkStats({user: noutObj.user, networkOutput: noutObj.networkOutput})
        .then(function(networkStats){
          console.log("networkStats\n" + jsonPrint(networkStats));
          cb();
        })
        .catch(function(err){
          console.log("NNT | ERROR: " + err);
          cb(err);
        });

      }, function(err){
        if (err) {
          return reject(err);
        }

        nnTools.printNetworkResults();
        console.log("NNT | TEST ACTIVATE END");
        resolve();

      });

    });

  });
}

// describe("neural networks", function() {

  // beforeEach(async function() {
  //  await User.deleteMany({}); // Delete all users
  // });

  // afterEach(async function() {
  //  await User.deleteMany({}); // Delete all users
  // });

  // after(async function() {
  //  if (db !== undefined) { db.close(); }
  // });
 
//   let currentBestNetworkStats = {};

//   describe("#activate()", async function() {

//    let userArray = [];
//    let networkIdArray = [];

//      await nnTools.setMaxInputHashMap(maxNormObj.maxInputHashMap);
//      await nnTools.setNormalization(maxNormObj.normalization);

//      usersFolder = path.join(__dirname, "users");

//      userArray = await loadUsers(usersFolder);
//      console.log("userArray.length: " + userArray.length);
//       userArray.length.should.equal(42);

//      const networksFolder = path.join(__dirname, "networks");
//      networkIdArray = await loadNetworks(networksFolder);

//      const randomNnId = randomItem(networkIdArray);
//      await nnTools.setPrimaryNeuralNetwork(randomNnId);

//      await activateUsers(userArray);

//      const statsObj = await nnTools.getNetworkStats();
//      // console.log("statsObj\n" + jsonPrint(statsObj));

//      // assert.ok();
//  });
// });

async function main(){
  try{

    await nnTools.setMaxInputHashMap(maxNormObj.maxInputHashMap);
    await nnTools.setNormalization(maxNormObj.normalization);

    const usersFolder = path.join(__dirname, "users");
    const userArray = await loadUsers(usersFolder);

    console.log("userArray.length: " + userArray.length);
    userArray.length.should.equal(42);

    const networksFolder = path.join(__dirname, "networks");
    const networkIdArray = await loadNetworks(networksFolder);

    const randomNnId = randomItem(networkIdArray);
    await nnTools.setPrimaryNeuralNetwork(randomNnId);

    await activateUsers(userArray);

    const statsObj = await nnTools.getNetworkStats();
    process.exit();
  }
  catch(err){
    if (err) { console.log("NNT | *** TEST ACTIVATE setPrimaryNeuralNetwork ERROR: " + err); }
    assert.ifError(err);
  }
}

// main();
