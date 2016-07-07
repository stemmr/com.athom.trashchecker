"use strict";

function init() {

	var http = require('http');
	var gdates = '';

	////For testing use these variables, will become pulled from settings
	function checkNextDay(args, state){
		
		var result = false;
		
		if(args.trash_type.toUpperCase() in state){
			state[args.trash_type.toUpperCase()].forEach(function (elem, index, arr){
				var today = new Date();
				today.setHours(0,0,0,0);//trash api is time indepedent, only days
				today.setDate((today.getDate() + 7));
				var pickDay = new Date(elem);
				
				if(pickDay.getDate() == today.getDate() && pickDay.getMonth() == today.getMonth() && pickDay.getFullYear() == today.getFullYear() && args.when == "today"){
					return (result = true);
				}

				today.setDate((today.getDate() + 1));

				if(pickDay.getDate() == today.getDate() && pickDay.getMonth() == today.getMonth() && pickDay.getFullYear() == today.getFullYear() && args.when == "tomorrow")//increment dat by one
				{
					
					return (result=true);
				}

				today.setDate((today.getDate() + 1));

				if(pickDay.getDate() == today.getDate() && pickDay.getMonth() == today.getMonth() && pickDay.getFullYear() == today.getFullYear() && args.when == "datomorrow")//increment day by one more(2 total) 
				{
					
					return (result = true);
				}
			});
		}

		return result;
	}
	
	Homey.manager('flow').on('condition.days_to_collect',function (callback, args){
		callback(null,checkNextDay(args,gdates));
	});
	/////END FLOW CARDS/////


	

	getUpdate()
	Homey.manager('cron').unregisterTask("checkDate",Homey.log)
	Homey.manager('cron').registerTask("checkDate",'* * * * *',"Heelloo",Homey.log);//0 1 * * *
	Homey.manager('cron').on("checkDate",function(data){
		getUpdate();
	})

	function getUpdate(){
		var postcode = Homey.manager('settings').get( 'postcode' ) || '5301BD';
		var homenumber = Homey.manager('settings').get('hnumber') || '11';
		var country = Homey.manager('settings').get('country') || 'NL';

		//Homey.log(postcode + " " + homenumber + " " + country);
		var options = {
			host: 'dataservice.deafvalapp.nl',
			path: '/dataservice/DataServiceServlet?type=ANDROID&service=OPHAALSCHEMA&land=' + country + '&postcode=' + postcode + '&straatId=0&huisnr=' + homenumber + '&huisnrtoev='	
		};
		
		var req = http.get(options, function (res){
			var dates = {};
			var curr = '';

			res.on('data',function(chunk){
				
				
				//parses the data from API into array with dates and types of trash
				var respArray = chunk.toString().split('\n').join('').split(";");
				respArray.pop();//oke oke ik geef toe beetje lelijk
				for(var i in respArray){
					if(isNaN(parseInt(respArray[i])))
					{
						
						dates[respArray[i]] = [];
						curr = respArray[i];
						
					}
					else{
						
						dates[curr].push(dateParse(respArray[i]));
					}
				}
				
				Homey.log(dates);
				gdates = dates;
				

			});
			req.on('error', function (err){
				Homey.log(err.message);
			});
		});
	
	//return res;
	}

	function dateParse(date){
		var elem = date.split('-');
		var day = new Date(elem[2], elem[1]-1, elem[0]);
		day.setHours(0,0,0,0);
		return day;
	}
}

module.exports.init = init;