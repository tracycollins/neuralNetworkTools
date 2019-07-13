
/*jslint node: true */
/*jshint sub:true*/
"use strict";

const debug = require("debug");
const _ = require("lodash");
const treeify = require("treeify");

function NetworkTools(){
}

function jsonPrint (obj){
  if (obj) {
    return treeify.asTree(obj, true, true);
  }
  else {
    return ("UNDEFINED");
  }
}

NetworkTools.prototype.activate = function(params){

  return new Promise(function(resolve, reject){
  	const results = {};
    resolve(results);
  });

};
module.exports = NetworkTools;
