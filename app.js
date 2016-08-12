/*globals Homey*/
"use strict";

var http = require('http');
var gdates = '';

function updateAPI(postcode, homenumber, country, callback){
		//postcode = '5301hBD';
		//homenumber = '13';
		//country = 'NL';


		var options = {
			host: 'dataservice.deafvalapp.nl',
			path: '/dataservice/DataServiceServlet?type=ANDROID&service=OPHAALSCHEMA&land=' + country + '&postcode=' + postcode + '&straatId=0&huisnr=' + homenumber + '&huisnrtoev='
		};

		var req = http.get(options, function (res){
			var dates = {};
			var curr = '';
			var data = '';

			res.on('data',function(chunk){

				data += chunk;

			});

			res.on('end', function(){

			var respArray = data.toString().split('\n').join('').split(";");
				respArray.pop();
				for(var i in respArray){
					if(isNaN(parseInt(respArray[i])))
					{
						dates[respArray[i]] = [];
						curr = respArray[i];
					}
					else{
						dates[curr].push(respArray[i]);
					}
				}

				if(Object.keys(dates).length === 0 && dates.constructor === Object){
					Homey.log('Invalid input');
					return callback(false);

				}else{//validate the response
					//Homey.log(dates);
					gdates = dates;
					return callback(true);


				}

			});
		});

		req.on('error', function (err){
				Homey.log(err.message);
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
					console.log('retrieved house information');
				}else{
					console.log('house information has not been set');
				}

			}
		);
	}
	//every 24 hours update API

	////For testing use these variables, will become pulled from settings

	Homey.manager('flow').on('condition.days_to_collect',function (callback, args){

		console.log(Object.keys(gdates));

		if( typeof gdates[ args.trash_type.toUpperCase() ] === 'undefined' )
		{
			return callback( new Error("Invalid address") );
		}

		var now = new Date();
		//to test on working date(or some other number)
		//now.setDate(now.getDate() + 2)
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
		)

	}, 86400000);


}

module.exports.init = init;

module.exports.updateAPI = updateAPI;

function pad(n, width, z) {
  z = z || '0';
  n = n + '';
  return n.length >= width ? n : new Array(width - n.length + 1).join(z) + n;
}
