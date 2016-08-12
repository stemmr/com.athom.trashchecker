/*globals Homey, module, require, setInterval*/
"use strict";

var http = require('http');
var apiArray = require('./trashapis.js');
var gdates = '';

function updateAPI(postcode, homenumber, country, callback){
		//postcode = '5301hBD';
		//homenumber = '13';
		//country = 'NL';
		function asyncLoop(iterations, func, callback) {
    var index = 0;
    var done = false;
    var loop = {
        next: function() {
            if (done) {
                return;
            }

            if (index < iterations) {
                index++;
                func(loop);

            } else {
                done = true;
                callback();
            }
        },

        iteration: function() {
            return index - 1;
        },

        break: function() {
            done = true;
            callback();
        }
    };
    loop.next();
    return loop;
	}

	asyncLoop(apiArray.length, function(loop){

		apiArray[loop.iteration()](postcode,homenumber,country,(err,result)=>{

				if(err) console.log('error while looping');
				console.log(result);
				if(Object.keys(result).length > 0){
					console.log('data received');
					gdates = result;
					callback(true);
				}else if(Object.keys(result).length === 0){
					console.log(loop);
					loop.next();
				}
		});
	},()=>{
		console.log('Checked all APIs');
		return callback(false);
	});





	}

function init() {
	if (Homey.manager('settings').get('postcode') &&
		Homey.manager('settings').get('hnumber') &&
		Homey.manager('settings').get('country')){

		updateAPI(
			Homey.manager('settings').get('postcode'),
			Homey.manager('settings').get('hnumber'),
			Homey.manager('settings').get('country'),
			function(success){
				if(success){
					Homey.log('retrieved house information');
				}else{
					Homey.log('house information has not been set');
				}

			}
		);
	}
	//every 24 hours update API

	////For testing use these variables, will become pulled from settings

	Homey.manager('flow').on('condition.days_to_collect',function (callback, args){

		Homey.log(Object.keys(gdates));

		if( typeof gdates[ args.trash_type.toUpperCase() ] === 'undefined' )
		{
			return callback( new Error("Invalid address") );
		}

		var now = new Date();
		//to test on working date(or some other number)
		now.setDate(now.getDate() -1);
		var dateString = '';
		if(args.when == 'tomorrow'){
			now.setDate(now.getDate() + 1);
		}else if(args.when == 'datomorrow'){
			now.setDate(now.getDate() + 2);
		}

		dateString += pad( now.getDate(), 2);
		dateString += '-';
		dateString += pad( now.getMonth()+1, 2);
		dateString += '-';
		dateString += now.getFullYear();

		Homey.log(dateString);

		return callback( null, gdates[ args.trash_type.toUpperCase() ].indexOf(dateString) > -1 );

	});

	setInterval(function(){

		updateAPI(
			Homey.manager('settings').get('postcode'),
			Homey.manager('settings').get('hnumber'),
			Homey.manager('settings').get('country'),
			function(){}
		);

	}, 86400000);//every day


}

module.exports.init = init;

module.exports.updateAPI = updateAPI;

function pad(n, width, z) {
  z = z || '0';
  n = n + '';
  return n.length >= width ? n : new Array(width - n.length + 1).join(z) + n;
}
