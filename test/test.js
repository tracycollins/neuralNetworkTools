
const debug = require("debug");
const should = require("should");
const assert = require("assert");
const mongoose = require("mongoose");
const treeify = require("treeify");
const cp = require("child_process");

let dbOptions = { 
	useNewUrlParser: true,
	keepAlive: 120,
	autoReconnect: true,
	autoIndex: false,
	reconnectTries: Number.MAX_VALUE,
	socketTimeoutMS: 90000,
	connectTimeoutMS: 0,
	poolSize: 100
};

const DEFAULT_INPUT_TYPES = [
	"emoji",
	"hashtags",
	"images",
	"media",
	"mentions",
	"locations",
	"places",
	"sentiment",
	"urls",
	"userMentions",
	// "squirrel",
	"words"
];

const jsonPrint = function (obj){
  if (obj) {
    return treeify.asTree(obj, true, true);
  }
  else {
    return "UNDEFINED";
  }
};

mongoose.connect("mongodb://localhost/test", dbOptions);

const db = mongoose.connection;

global.dbConnection = db;

const emojiModel = require("@threeceelabs/mongoose-twitter/models/emoji.server.model");
const hashtagModel = require("@threeceelabs/mongoose-twitter/models/hashtag.server.model");
const mediaModel = require("@threeceelabs/mongoose-twitter/models/media.server.model");
const neuralNetworkModel = require("@threeceelabs/mongoose-twitter/models/neuralNetwork.server.model");
const networkInputsModel = require("@threeceelabs/mongoose-twitter/models/networkInputs.server.model");
const placeModel = require("@threeceelabs/mongoose-twitter/models/place.server.model");
const tweetModel = require("@threeceelabs/mongoose-twitter/models/tweet.server.model");
const urlModel = require("@threeceelabs/mongoose-twitter/models/url.server.model");
const userModel = require("@threeceelabs/mongoose-twitter/models/user.server.model");
const wordModel = require("@threeceelabs/mongoose-twitter/models/word.server.model");

let NeuralNetwork;
let Emoji;
let Hashtag;
let Media;
let Place;
let Tweet;
let Url;
let User;
let Word;

Emoji = mongoose.model("Emoji", emojiModel.EmojiSchema);
Hashtag = mongoose.model("Hashtag", hashtagModel.HashtagSchema);
Media = mongoose.model("Media", mediaModel.MediaSchema);
NeuralNetwork = mongoose.model("NeuralNetwork", neuralNetworkModel.NeuralNetworkSchema);
Place = mongoose.model("Place", placeModel.PlaceSchema);
Tweet = mongoose.model("Tweet", tweetModel.TweetSchema);
Url = mongoose.model("Url", urlModel.UrlSchema);
User = mongoose.model("User", userModel.UserSchema);
Word = mongoose.model("Word", wordModel.WordSchema);

const UserServerController = require("@threeceelabs/user-server-controller");
const userServerController = new UserServerController("WAS_TEST_USC");

describe("mongoose", function() {

  beforeEach(async function() {
	  await User.deleteMany({}); // Delete all users
  });

  afterEach(async function() {
	  await User.deleteMany({}); // Delete all users
  });

  after(async function() {
	  if (db !== undefined) { db.close(); }
  });

  describe("users", function() {

    it("create and find 1 user", async function() {

		  let tobi = new User({ nodeId: "1234", name: "tobi"});

		  let savedUser0 = await tobi.save();

		  const res = await User.find({});

      res.should.have.length(1);
      res[0].should.have.property("name", "tobi");

      debug(res[0].name);
    });
    
    it("create and find 2 users", async function() {

		  let tobi = new User({ nodeId: "1234", name: "tobi"});
		  let hector = new User({ nodeId: "54321", name: "hector"});

		  let savedUser0 = await tobi.save();
		  let savedUser1 = await hector.save();

		  const res = await User.find({});

      res.should.have.length(2);
      res[0].should.have.property("name", "tobi");
      res[1].should.have.property("name", "hector");
    });
    
    it("userServerController updateHistograms", async function() {

		  let tobi = new User({ nodeId: "1234", name: "tobi"});
		  let hector = new User({ nodeId: "54321", name: "hector"});

		  let savedTobi = await tobi.save();
		  let savedHector = await hector.save();

		  const res = await User.find({});

      res.should.have.length(2);
      res[0].should.have.property("name", "tobi");
      res[1].should.have.property("name", "hector");

    	let userServerController = new UserServerController();

    	let testInputHistogram = {};

	  	DEFAULT_INPUT_TYPES.forEach(function(type){
	  		if (testInputHistogram[type] === undefined) { testInputHistogram[type] = {}; }
	  		switch (type) {
	  			case "emoji":
	  				testInputHistogram[type][":bug:"] = 21;
	  				break;
	  			case "hashtags":
	  				testInputHistogram[type]["#tracy"] = 47;
	  				break;
	  			case "userMentions":
	  				testInputHistogram[type]["@threecee"] = 333;
	  				break;
	  			case "mentions":
	  				testInputHistogram[type]["@collins"] = 3;
	  				break;
	  			case "locations":
	  				testInputHistogram[type]["East Butt Fuck"] = 1;
	  				break;
	  			case "places":
	  				testInputHistogram[type]["df51dec6f4ee2b2c"] = 10;
	  				break;
	  			case "sentiment":
	  				testInputHistogram[type].score = -0.534;
	  				testInputHistogram[type].magnitude = 14.7;
	  				break;
	  			case "images":
	  				testInputHistogram[type]["deez"] = 283;
	  				break;
	  			case "media":
	  				testInputHistogram[type]["861627472244162561"] = 499;
	  				break;
	  			case "urls":
	  				testInputHistogram[type]["HkTkwFq8UT"] = 86;
	  				break;
	  			case "words":
	  				testInputHistogram[type]["love"] = 44;
	  				break;
	  			default:
	  				console.log("??? UNDEFINED HISTOGRAM INPUT TYPE: " + type);
	  				throw(new Error("UNDEFINED HISTOGRAM INPUT TYPE: " + type));
	  		}
	  	});

			debug("testInputHistogram\n", testInputHistogram);

			const updateHistogramsPromise = function (params) { 

				return new Promise(function(resolve, reject){

					// console.log("params\n", params);

		    	userServerController.updateHistograms(params, function(err, updatedUser){
		    		if (err) { return reject(err); }
		    		resolve(updatedUser);
		    	});

				});
			};

			let updatedUser = await updateHistogramsPromise({user: savedTobi, histograms: testInputHistogram});

			debug("updatedUser: " + updatedUser.name + "\n" + jsonPrint(updatedUser.histograms));
      updatedUser.should.have.property("name", "tobi");
      updatedUser.should.have.propertyByPath("histograms", "emoji", ":bug:").eql(21);

			updatedUser = await updateHistogramsPromise({user: savedTobi, histograms: testInputHistogram});

			debug("updatedUser: " + updatedUser.name + "\n" + jsonPrint(updatedUser.histograms));
      updatedUser.should.have.property("name", "tobi");
      updatedUser.should.have.propertyByPath("histograms", "emoji", ":bug:").eql(21);

			let updatedUserAccumulated = await updateHistogramsPromise({user: updatedUser, histograms: testInputHistogram, accumulateFlag: true});

			// accumalate => each value should be doubled
			debug("updatedUserAccumulated: " + updatedUserAccumulated.name + "\n" + jsonPrint(updatedUserAccumulated.histograms));
      updatedUserAccumulated.should.have.property("name", "tobi");
      updatedUserAccumulated.should.have.propertyByPath("histograms", "emoji", ":bug:").eql(42);
    });

    it("fork TSS", async function(){

    	this.timeout(20000);

    	const quitDelayPromise = function(params){

    		return new Promise(function(resolve, reject){

	    		params = params || {};

	    		const interval = params.interval || 10000;


    			const quitTimeout = setTimeout(function(){
    				tss.send({op: "QUIT"});
    				resolve(true);
    			}, params.interval);

    		});

    	};

			let childEnv = {
				"TWITTER_MAX_TRACKING_NUMBER": 47,
			  "DROPBOX_DEFAULT_SEARCH_TERMS_DIR": "/config/utility/default",
			  "DROPBOX_DEFAULT_SEARCH_TERMS_FILE": "defaultSearchTerms.txt",
			  "TSS_PROCESS_NAME": "tssChild_test",
			  "TSS_ENABLE_STDIN": true,
			  "DROPBOX_WORD_ASSO_DEFAULT_TWITTER_CONFIG": "/config/twitter/twitterConfig_ninjathreeceeTwitterTest_00.json",
			  "TSS_STATS_UPDATE_INTERVAL": 60000,
			  "TSS_TWITTER_USERS": [ "altthreecee05" ],
			  "TSS_KEEPALIVE_INTERVAL": 15000,
			  "TSS_TWITTER_QUEUE_INTERVAL": 10
			};

	    const tss = await cp.fork(`./js/libs/tssChild.js`, childEnv);

	    const result = await quitDelayPromise({interval: 5000});

    });
    
  });
});